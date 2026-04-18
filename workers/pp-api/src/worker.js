// pp-api worker for Radar + Top Permits (LA)
// Runtime: Cloudflare Workers (Modules)

import { JURISDICTIONS } from './config/jurisdictions.js';
import {
	ALLOWED_ORIGINS,
	JSON_HEADERS,
	LADBS_SOURCE,
	RADAR_KEYWORDS,
	STORM_WORDS,
} from './config/permits.js';
import { arcgisQuery as fetchArcgisRows } from "./providers/arcgis.js";
import { handleMissionControlReport } from './mission-control/report.js';
import { fetchSocrataRows } from './providers/socrata.js';

const PASADENA_JURISDICTION_ID = 'pasadena';
const PASADENA_ACTIVE_BUILDING_PERMITS_LAYER_URL =
	'https://services2.arcgis.com/zNjnZafDYCAJAbN0/arcgis/rest/services/Active_Building_Permits_view/FeatureServer/0';

function corsHeaders(origin) {
	const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
	return {
		'access-control-allow-origin': allow,
		'access-control-allow-methods': 'GET, POST, OPTIONS',
		'access-control-allow-headers': 'content-type, authorization',
		'access-control-max-age': '86400',
		vary: 'origin',
	};
}

function preflightResponse(origin) {
	return new Response(null, { headers: corsHeaders(origin) });
}

function withCors(req, resp) {
	const headers = new Headers(resp.headers);
	for (const [key, value] of Object.entries(corsHeaders(req.headers.get('Origin') || ''))) {
		headers.set(key, value);
	}
	return new Response(resp.body, { status: resp.status, headers });
}

function json(obj, status = 200, extra = {}) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: {
			...JSON_HEADERS,
			...extra,
		},
	});
}

function err(message, detail = null, status = 500) {
	return json({ ok: false, error: message, detail }, status);
}

function jsonWithCache(obj, status = 200, ttlSeconds = 120) {
	return json(obj, status, {
		'cache-control': `public, max-age=0, s-maxage=${ttlSeconds}`,
	});
}

function apiEnvelope(ok, data = null, error = null) {
	return { ok, data, error };
}

function qs(params) {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') {
			searchParams.set(key, value);
		}
	}
	return searchParams.toString();
}

function uniqueNonEmptyValues(values) {
	return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function parseIssueDate(value) {
	if (!value) return null;

	if (typeof value === 'number') {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const input = String(value);
	if (/^\d{11,}$/.test(input)) {
		const date = new Date(Number(input));
		return Number.isNaN(date.getTime()) ? null : date;
	}
	const isoDate = new Date(input);
	if (!Number.isNaN(isoDate.getTime())) {
		return isoDate;
	}

	const parts = input.split(/[/-]/);
	if (parts.length !== 3) {
		return null;
	}

	const [a, b, c] = parts;
	if (a.length === 4) {
		const date = new Date(Number(a), Number(b) - 1, Number(c));
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const date = new Date(Number(c), Number(a) - 1, Number(b));
	return Number.isNaN(date.getTime()) ? null : date;
}

function parseValuation(value) {
	if (value == null) return 0;
	const clean = String(value).replace(/[^0-9.]/g, '');
	const parsed = parseFloat(clean);
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePermitRow(row, source = LADBS_SOURCE) {
	const issueDate = row[source.filedField] || null;
	return {
		permitNumber: row[source.permitField] || null,
		issueDate,
		issueDateObj: parseIssueDate(issueDate),
		address: row[source.addrField] || row.address || '',
		zip: row[source.zipField] || null,
		value: parseValuation(row[source.valField]),
		description: row[source.descField] || row.work_description || row.description || null,
	};
}

function createLadbsUrl(limit, source = LADBS_SOURCE) {
	const url = new URL(`https://${source.domain}/resource/${source.dataset}.json`);
	url.searchParams.set('$order', `${source.filedField} DESC`);
	url.searchParams.set('$limit', String(limit));
	return url;
}

function createSocrataHeaders(env) {
	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) {
		headers['X-App-Token'] = env.SOC_APP_TOKEN;
	}
	return headers;
}

async function fetchJsonFromUrl(url, env) {
	let status = 200;
	let error = null;
	let rows = [];
	let errorDetail = null;

	try {
		const response = await fetch(url.toString(), { headers: createSocrataHeaders(env) });
		if (!response.ok) {
			status = 502;
			error = `ladbs_fetch_failed_${response.status}`;
			const text = await response.text();
			errorDetail = text;
			try {
				rows = JSON.parse(text);
			} catch {
				rows = [];
			}
		} else {
			rows = await response.json();
		}
	} catch (e) {
		status = 502;
		error = 'ladbs_fetch_exception';
		errorDetail = e && e.message ? String(e.message) : String(e);
		rows = [];
	}

	return {
		status,
		error,
		rows: Array.isArray(rows) ? rows : [],
		errorDetail,
	};
}

async function loadLadbsRows(env, limit, source = LADBS_SOURCE) {
	const socUrl = createLadbsUrl(limit, source);
	const result = await fetchJsonFromUrl(socUrl, env);
	return { socUrl, ...result };
}

function matchesTrade(description, trade, mode = 'normal') {
	const normalizedDescription = (description || '').toLowerCase();
	const normalizedTrade = (trade || '').toLowerCase();
	const normalizedMode = (mode || 'normal').toLowerCase();

	if (!normalizedDescription) {
		return false;
	}

	if (normalizedTrade === 'roof') {
		const basicRoof =
			normalizedDescription.includes('roof') ||
			normalizedDescription.includes('reroof') ||
			normalizedDescription.includes('re-roof') ||
			normalizedDescription.includes('re roof');

		if (!basicRoof) {
			return false;
		}

		if (normalizedMode === 'storm') {
			return STORM_WORDS.some((word) => normalizedDescription.includes(word));
		}

		return true;
	}

	if (normalizedTrade === 'solar') {
		return (
			normalizedDescription.includes('solar') ||
			normalizedDescription.includes('pv') ||
			normalizedDescription.includes('photovoltaic') ||
			normalizedDescription.includes('photovoltaics')
		);
	}

	if (normalizedTrade === 'hvac') {
		return (
			normalizedDescription.includes('hvac') ||
			normalizedDescription.includes('furnace') ||
			normalizedDescription.includes('air conditioning') ||
			normalizedDescription.includes('a/c') ||
			normalizedDescription.includes('heat pump')
		);
	}

	if (normalizedTrade === 'addition') {
		return (
			normalizedDescription.includes('addition') ||
			normalizedDescription.includes('addn') ||
			normalizedDescription.includes('adu') ||
			normalizedDescription.includes('garage conversion')
		);
	}

	if (normalizedTrade === 'electrical') {
		return (
			normalizedDescription.includes('electrical') ||
			normalizedDescription.includes('service upgrade') ||
			normalizedDescription.includes('panel') ||
			normalizedDescription.includes('main switchboard')
		);
	}

	return true;
}

function parseRequestUrl(reqOrUrl) {
	try {
		if (reqOrUrl instanceof URL) return reqOrUrl;
		if (reqOrUrl && typeof reqOrUrl.url === 'string') return new URL(reqOrUrl.url);
		if (typeof reqOrUrl === 'string') return new URL(reqOrUrl);
	} catch (_) {}
	return null;
}

function sanitizeDomain(domain) {
	return String(domain || LADBS_SOURCE.domain)
		.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/\/+$/, '');
}

function isSelfFetchTarget(target) {
	if (!target) return false;

	try {
		const hostname = new URL(target).hostname.toLowerCase();
		return hostname === 'api.getpermitpulse.com' || hostname.endsWith('.workers.dev');
	} catch {
		return false;
	}
}

function normalizePathname(pathname) {
	return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function findJurisdiction(jurisdictionId) {
	return JURISDICTIONS.find((jurisdiction) => jurisdiction.id === jurisdictionId) || null;
}

function getPasadenaJurisdiction() {
	const jurisdiction = findJurisdiction(PASADENA_JURISDICTION_ID);
	return jurisdiction?.provider?.type === 'arcgis' ? jurisdiction : null;
}

function normalizeHistoryDate(value) {
	const parsed = parseIssueDate(value);
	return parsed ? parsed.toISOString() : null;
}

function buildProviderOutFields(provider, extraFields = []) {
	return uniqueNonEmptyValues([...Object.values(provider?.fields || {}), ...extraFields]).join(',');
}

function normalizeArcgisPointGeometry(geometry) {
	if (!geometry || typeof geometry.x !== 'number' || typeof geometry.y !== 'number') {
		return { latitude: null, longitude: null };
	}

	if (Math.abs(geometry.x) <= 180 && Math.abs(geometry.y) <= 90) {
		return {
			longitude: Number(geometry.x.toFixed(6)),
			latitude: Number(geometry.y.toFixed(6)),
		};
	}

	const longitude = (geometry.x / 20037508.34) * 180;
	let latitude = (geometry.y / 20037508.34) * 180;
	latitude = (180 / Math.PI) * (2 * Math.atan(Math.exp((latitude * Math.PI) / 180)) - Math.PI / 2);

	return {
		longitude: Number(longitude.toFixed(6)),
		latitude: Number(latitude.toFixed(6)),
	};
}

function isWithinSinceDays(dateValue, sinceDays) {
	if (sinceDays == null) {
		return true;
	}

	const parsed = parseIssueDate(dateValue);
	if (!parsed) {
		return false;
	}

	return parsed.getTime() >= Date.now() - sinceDays * 24 * 60 * 60 * 1000;
}

function normalizePasadenaLiveRecord(feature, jurisdiction) {
	const provider = jurisdiction?.provider;
	const fields = provider?.fields || {};
	const row = feature?.attributes || {};
	const geometry = normalizeArcgisPointGeometry(feature?.geometry);
	const id = row[fields.id] || null;
	const filedAt = normalizeHistoryDate(row[fields.filed_at]);
	const issuedAt = fields.issued_at ? normalizeHistoryDate(row[fields.issued_at]) : null;
	const updatedAt = fields.updated_at ? normalizeHistoryDate(row[fields.updated_at]) : filedAt;
	const rawValuation = fields.valuation ? row[fields.valuation] : null;

	return {
		id,
		permit_id: id,
		jurisdiction: jurisdiction.id,
		status: fields.status ? row[fields.status] ?? null : null,
		type: fields.type ? row[fields.type] ?? null : null,
		description: fields.description ? row[fields.description] ?? null : null,
		address: fields.address ? row[fields.address] ?? null : null,
		applied_at: null,
		filed_at: filedAt,
		issued_at: issuedAt,
		updated_at: updatedAt,
		valuation: rawValuation == null ? null : parseValuation(rawValuation),
		latitude: geometry.latitude,
		longitude: geometry.longitude,
		source_url: buildHistorySourceUrl(jurisdiction, id),
		apn: fields.apn ? row[fields.apn] ?? null : null,
		parcel: fields.parcel ? row[fields.parcel] ?? null : null,
	};
}

function buildCkanDatastoreUrl(provider) {
	if (provider.baseUrl) return provider.baseUrl;
	if (provider.domain) return `https://${provider.domain}/api/3/action/datastore_search`;
	if (provider.base) return new URL('/api/3/action/datastore_search', provider.base).toString();
	return '';
}

async function fetchCkanRows({ baseUrl, resourceId, q, limit = 200, sort }) {
	if (!baseUrl || !resourceId) {
		throw new Error('invalid_ckan_provider');
	}

	const url = new URL(baseUrl);
	url.searchParams.set('resource_id', resourceId);
	url.searchParams.set('limit', String(limit));
	if (sort) {
		url.searchParams.set('sort', sort);
	}
	if (q) {
		url.searchParams.set('q', q);
	}

	const response = await fetch(url.toString(), {
		headers: { Accept: 'application/json' },
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`upstream ${response.status}: ${detail || 'request failed'}`);
	}

	const data = await response.json().catch(() => null);
	if (!data?.success || !data?.result) {
		throw new Error('upstream 502: invalid ckan response');
	}

	return {
		url: url.toString(),
		rows: Array.isArray(data.result.records) ? data.result.records : [],
	};
}

function buildPortalMeta(jurisdiction) {
	return {
		jurisdiction: jurisdiction.id,
		state: jurisdiction.state || null,
		portal_url: jurisdiction.portalUrl || null,
		portal_notes: jurisdiction.portalNotes || null,
		portal_platform: jurisdiction.platform || null,
		provider_available: Boolean(jurisdiction.provider),
	};
}

function buildHistorySourceUrl(jurisdiction, id) {
	const provider = jurisdiction.provider;
	if (!provider) {
		return jurisdiction.portalUrl || null;
	}
	if (provider.type === 'socrata') {
		return id
			? `https://${provider.domain}/resource/${provider.dataset}.json?${new URLSearchParams({
					[provider.fields.id]: id,
					$limit: '1',
				}).toString()}`
			: `https://${provider.domain}/resource/${provider.dataset}`;
	}

	if (provider.type === 'arcgis') {
		const url = new URL(`${provider.layerBaseUrl.replace(/\/query\b.*$/, '')}/query`);
		url.searchParams.set('where', id ? `${provider.fields.id} = '${String(id).replace(/'/g, "''")}'` : '1=1');
		url.searchParams.set('outFields', '*');
		url.searchParams.set('returnGeometry', 'false');
		url.searchParams.set('f', 'json');
		return url.toString();
	}

	if (provider.type === 'ckan') {
		const baseUrl = buildCkanDatastoreUrl(provider);
		const resourceId = provider.resourceId || provider.resource_id;
		const url = new URL(baseUrl);
		url.searchParams.set('resource_id', resourceId);
		url.searchParams.set('limit', '1');
		if (id) {
			url.searchParams.set('q', String(id));
		}
		return url.toString();
	}

	return null;
}

function escapeArcgisWhereValue(value) {
	return String(value || '').replace(/'/g, "''").toUpperCase();
}

function buildArcgisHistoryWhere(provider, q) {
	const query = String(q || '').trim();
	if (!query) {
		return '1=1';
	}

	const fields = Array.isArray(provider.searchFields) ? provider.searchFields.filter(Boolean).slice(0, 4) : [];
	if (!fields.length) {
		return '1=1';
	}

	const escapedQuery = escapeArcgisWhereValue(query);
	return `(${fields.map((field) => `UPPER(${field}) LIKE '%${escapedQuery}%'`).join(' OR ')})`;
}

function matchesHistoryQuery(record, q) {
	if (!q) {
		return true;
	}

	const needle = q.toLowerCase();
	return [
		record.id,
		record.address,
		record.status,
		record.type,
		record.subtype,
		record.description,
	]
		.filter(Boolean)
		.some((value) => String(value).toLowerCase().includes(needle));
}

function normalizeHistoryRecord(row, jurisdiction) {
	const fields = jurisdiction.provider.fields;
	const id = row.id || row.permit_number || row[fields.id] || null;
	const address =
		row.address ||
		row[fields.address] ||
		(fields.alt_address ? row[fields.alt_address] : null) ||
		null;
	const filedAt = normalizeHistoryDate(row.filed_at ?? row[fields.filed_at]);
	const issuedAt = normalizeHistoryDate(fields.issued_at ? (row.issued_at ?? row[fields.issued_at]) : row.issued_at);
	const rawValuation = row.valuation ?? row[fields.valuation];
	const valuation = rawValuation == null ? null : parseValuation(rawValuation);
	const descriptionText = (row.description ?? row[fields.description]) || null;
	const description = String(descriptionText || '').toLowerCase();
	const riskFlags = [];

	if (valuation == null || valuation === 0) {
		riskFlags.push('MISSING_VALUATION');
	}
	if (!address) {
		riskFlags.push('MISSING_ADDRESS');
	}
	if (valuation != null && valuation >= 250000) {
		riskFlags.push('HIGH_VALUATION');
	}

	const filedDate = parseIssueDate(filedAt);
	if (filedDate && filedDate.getTime() >= Date.now() - 14 * 24 * 60 * 60 * 1000) {
		riskFlags.push('RECENT_FILED');
	}
	if (
		description.includes('roof') ||
		description.includes('reroof') ||
		description.includes('re-roof') ||
		description.includes('re roof')
	) {
		riskFlags.push('TRADE_ROOFING');
	}
	if (
		description.includes('solar') ||
		description.includes('pv') ||
		description.includes('photovoltaic') ||
		description.includes('photovoltaics')
	) {
		riskFlags.push('TRADE_SOLAR');
	}

	const sourceUrl = buildHistorySourceUrl(jurisdiction, id);

	return {
		id,
		address,
		status: row.status ?? (fields.status ? row[fields.status] ?? null : null),
		type: row.type ?? (fields.type ? row[fields.type] ?? null : null),
		subtype: row.subtype ?? (fields.subtype ? row[fields.subtype] ?? null : null),
		filed_at: filedAt,
		issued_at: issuedAt,
		valuation,
		description: descriptionText,
		source_url: sourceUrl,
		risk_flags: riskFlags,
	};
}

function shouldIncludeHistoryRecord(record, q, days, minVal, options = {}) {
	if (options.applyQueryFilter !== false && !matchesHistoryQuery(record, q)) {
		return false;
	}

	if (record.filed_at) {
		const filedDate = parseIssueDate(record.filed_at);
		if (!filedDate) {
			return false;
		}
		if (filedDate.getTime() < Date.now() - days * 24 * 60 * 60 * 1000) {
			return false;
		}
	}

	if (record.valuation == null) {
		return minVal <= 0;
	}

	return record.valuation >= minVal;
}

async function fetchHistoryRows(env, jurisdiction, params) {
	if (jurisdiction.provider.type === 'socrata') {
		return fetchSocrataRows(env, jurisdiction.provider, params);
	}

	if (jurisdiction.provider.type === 'arcgis') {
		const result = await fetchArcgisRows({
			layerBaseUrl: jurisdiction.provider.layerBaseUrl,
			outFields: '*',
			orderByFields: jurisdiction.provider.orderByFields,
			where: buildArcgisHistoryWhere(jurisdiction.provider, params.q),
			limit: params.fetchLimit,
		});

		if (!result?.ok) {
			throw new Error(`upstream ${result?.status || 502}: ${result?.errorText || 'request failed'}`);
		}

		return {
			url: result.url,
			rows: Array.isArray(result.features) ? result.features.map((feature) => feature?.attributes || {}) : [],
		};
	}

	if (jurisdiction.provider.type === 'ckan') {
		const baseUrl = buildCkanDatastoreUrl(jurisdiction.provider);
		const resourceId = jurisdiction.provider.resourceId || jurisdiction.provider.resource_id;
		return fetchCkanRows({
			baseUrl,
			resourceId,
			q: params.q,
			limit: params.fetchLimit,
			sort:
				jurisdiction.provider.sort ||
				(jurisdiction.provider.fields?.filed_at ? `${jurisdiction.provider.fields.filed_at} desc` : undefined),
		});
	}

	throw new Error('unsupported_provider');
}

async function fetchPasadenaArcgisFeatures({ q = '', limit = 25, returnGeometry = false, outFields }) {
	const jurisdiction = getPasadenaJurisdiction();
	if (!jurisdiction) {
		throw new Error('pasadena_not_configured');
	}

	const result = await fetchArcgisRows({
		layerBaseUrl: jurisdiction.provider.layerBaseUrl,
		outFields: outFields || buildProviderOutFields(jurisdiction.provider),
		orderByFields: jurisdiction.provider.orderByFields,
		where: buildArcgisHistoryWhere(jurisdiction.provider, q),
		limit: Math.max(1, Math.min(limit, 2000)),
		returnGeometry,
		outSR: returnGeometry ? 4326 : undefined,
	});

	if (!result?.ok) {
		throw new Error(`upstream ${result?.status || 502}: ${result?.errorText || 'request failed'}`);
	}

	return {
		jurisdiction,
		url: result.url,
		features: Array.isArray(result.features) ? result.features : [],
	};
}

async function probePasadenaLiveData() {
	const jurisdiction = getPasadenaJurisdiction();
	if (!jurisdiction) {
		return {
			ok: false,
			error: 'pasadena_not_configured',
		};
	}

	try {
		const { url, features } = await fetchPasadenaArcgisFeatures({
			limit: 1,
			returnGeometry: false,
			outFields: uniqueNonEmptyValues([
				jurisdiction.provider.fields.id,
				jurisdiction.provider.fields.filed_at,
				jurisdiction.provider.fields.updated_at,
			]).join(','),
		});
		const first = features[0]?.attributes || {};
		return {
			ok: features.length > 0,
			count: features.length,
			source_url: url,
			latest_id: first[jurisdiction.provider.fields.id] || null,
		};
	} catch (error) {
		return {
			ok: false,
			error: String(error?.message || error),
		};
	}
}

async function handleTopPermits({ url, env }) {
	const search = url.searchParams;
	const rawDays = Number(search.get('days') || '30');
	const rawMin = Number(search.get('min') || '250000');
	const rawLimit = Number(search.get('limit') || '25');
	const trade = (search.get('trade') || 'roof').toLowerCase();
	const debug = search.get('debug') === '1';
	const mode = (search.get('mode') || 'normal').toLowerCase();

	const days = !Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 365 ? 30 : rawDays;
	const minValue = !Number.isFinite(rawMin) || rawMin < 0 ? 0 : rawMin;
	const limit = !Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 200 ? 25 : rawLimit;
	const fetchLimit = Math.max(limit * 5, 500);

	const { socUrl, status, error, rows, errorDetail } = await loadLadbsRows(env, fetchLimit);
	const minTime = Date.now() - days * 24 * 60 * 60 * 1000;

	const permits = rows
		.map((row) => normalizePermitRow(row))
		.filter((permit) => {
			if (!permit.issueDateObj) return false;
			if (permit.issueDateObj.getTime() < minTime) return false;
			if (permit.value < minValue) return false;
			return matchesTrade(permit.description, trade, mode);
		})
		.sort((a, b) => b.value - a.value)
		.slice(0, limit)
		.map((permit) => ({
			permitNumber: permit.permitNumber,
			issueDate: permit.issueDate,
			address: permit.address,
			zip: permit.zip,
			value: permit.value,
			description: permit.description,
			trade,
		}));

	return json({
		ok: !error,
		meta: {
			days,
			minValue,
			limit,
			trade,
			source: `LADBS permits via https://${LADBS_SOURCE.domain}/resource/${LADBS_SOURCE.dataset}`,
			error,
			count: permits.length,
		},
		permits,
		debug: debug
			? {
					socUrl: socUrl.toString(),
					fetchedRows: rows.length,
					errorDetail,
				}
			: undefined,
	}, error ? status : 200);
}

async function handleAddressPulse({ url, env }) {
	const search = url.searchParams;
	const q = (search.get('q') || '').trim();
	const zipFilter = (search.get('zip') || '').trim();
	const rawYears = Number(search.get('years') || '3');
	const debug = search.get('debug') === '1';

	const years = !Number.isFinite(rawYears) || rawYears <= 0 || rawYears > 10 ? 3 : rawYears;
	const days = years * 365;
	const { socUrl, status, error, rows, errorDetail } = await loadLadbsRows(env, 2000);
	const minTime = Date.now() - days * 24 * 60 * 60 * 1000;
	const qLower = q.toLowerCase();

	const permits = rows
		.map((row) => normalizePermitRow(row))
		.filter((permit) => {
			if (!permit.issueDateObj) return false;
			if (permit.issueDateObj.getTime() < minTime) return false;
			if (zipFilter && permit.zip !== zipFilter) return false;

			if (qLower) {
				const address = (permit.address || '').toLowerCase();
				const permitNumber = String(permit.permitNumber || '').toLowerCase();
				if (!address.includes(qLower) && !permitNumber.includes(qLower)) {
					return false;
				}
			}

			return true;
		})
		.sort((a, b) => b.issueDateObj - a.issueDateObj)
		.slice(0, 200);

	return json({
		ok: !error,
		meta: {
			q,
			zip: zipFilter,
			years,
			days,
			source: `LADBS permits via https://${LADBS_SOURCE.domain}/resource/${LADBS_SOURCE.dataset}`,
			error,
			count: permits.length,
		},
		permits: permits.map((permit) => ({
			permitNumber: permit.permitNumber,
			issueDate: permit.issueDate,
			address: permit.address,
			zip: permit.zip,
			value: permit.value,
			description: permit.description,
		})),
		debug: debug
			? {
					socUrl: socUrl.toString(),
					fetchedRows: rows.length,
					errorDetail,
				}
			: undefined,
	}, error ? status : 200);
}

async function sodaFetch(env, query) {
	const base = `https://${env.SOC_DOMAIN}/resource/${env.SOC_DATASET}.json`;
	const url = `${base}?${query}`;
	const headers = createSocrataHeaders(env);

	const response = await fetch(url, { headers });
	if (!response.ok) {
		const text = await response.text().catch(() => '');
		const detail = text || `status ${response.status}`;
		throw new Error(`upstream ${response.status}: ${detail}`);
	}

	return { url, rows: await response.json() };
}

async function handleHealth() {
	const failing = JURISDICTIONS.filter((jurisdiction) => jurisdiction.enabled === false).map((jurisdiction) => jurisdiction.id);
	const pasadena = await probePasadenaLiveData();
	if (!pasadena.ok) {
		failing.push(PASADENA_JURISDICTION_ID);
	}

	return json({
		ok: true,
		service: 'pp-api',
		ts: new Date().toISOString(),
		upstreams: {
			upstream_ok: failing.length === 0,
			failing,
			pasadena,
		},
	});
}

async function handleRadar({ url, env }) {
	const urlObj = parseRequestUrl(url);
	if (!urlObj) {
		return new Response(JSON.stringify({ ok: false, error: 'bad_request', detail: 'Bad request URL' }), {
			status: 400,
			headers: JSON_HEADERS,
		});
	}

	const domain = sanitizeDomain(env.SOC_DOMAIN || LADBS_SOURCE.domain);
	const dataset = String(env.SOC_DATASET || LADBS_SOURCE.dataset).trim();
	const search = urlObj.searchParams;
	const jurisdictionId = (search.get('jurisdiction') || 'la_city').trim().toLowerCase();
	const trade = (search.get('trade') || 'roof').toLowerCase();
	const days = Math.max(1, Math.min(parseInt(search.get('days') || '7', 10), 30));
	const limit = Math.max(1, Math.min(parseInt(search.get('limit') || '50', 10), 200));
	const debug = search.has('debug');

	if (jurisdictionId === PASADENA_JURISDICTION_ID) {
		try {
			const fetchLimit = Math.max(limit * 5, 200);
			const { jurisdiction, url: sourceUrl, features } = await fetchPasadenaArcgisFeatures({
				limit: fetchLimit,
				returnGeometry: true,
			});
			const rows = features
				.map((feature) => normalizePasadenaLiveRecord(feature, jurisdiction))
				.filter((record) => matchesTrade(record.description, trade))
				.filter((record) => isWithinSinceDays(record.updated_at || record.filed_at || record.issued_at, days))
				.slice(0, limit)
				.map((record) => ({
					permit_nbr: record.id,
					issue_date: record.updated_at || record.filed_at || record.issued_at,
					work_desc: record.description,
					permit_type: record.type,
					permit_sub_type: null,
					primary_address: record.address,
					zip_code: null,
					valuation: record.valuation,
					lat: record.latitude,
					lon: record.longitude,
					status: record.status,
					source_url: record.source_url,
					jurisdiction: record.jurisdiction,
				}));

			return new Response(
				JSON.stringify({
					ok: true,
					count: rows.length,
					count_1: String(rows.length),
					'count(*)': rows.length,
					total: rows.length,
					view: PASADENA_JURISDICTION_ID,
					dataset: PASADENA_JURISDICTION_ID,
					source_view: PASADENA_JURISDICTION_ID,
					view_id: PASADENA_JURISDICTION_ID,
					url: sourceUrl,
					ui: jurisdiction.provider.layerBaseUrl,
					rows,
					params: { jurisdiction: PASADENA_JURISDICTION_ID, trade, days, limit },
					...(debug
						? {
								debug: {
									source_layer_url: jurisdiction.provider.layerBaseUrl,
									secondary_layer_url: PASADENA_ACTIVE_BUILDING_PERMITS_LAYER_URL,
									fetchLimit,
								},
							}
						: {}),
				}),
				{ headers: JSON_HEADERS },
			);
		} catch (error) {
			return new Response(
				JSON.stringify({
					ok: false,
					error: 'upstream',
					detail: String(error?.message || error),
					jurisdiction: PASADENA_JURISDICTION_ID,
				}),
				{
					status: 502,
					headers: JSON_HEADERS,
				},
			);
		}
	}

	const end = new Date();
	const start = new Date(end.getTime() - days * 86400000);
	const isoNoZ = (date) => date.toISOString().replace('Z', '');
	const terms = RADAR_KEYWORDS[trade] || RADAR_KEYWORDS.roof;
	const likeBlock = terms.length
		? `(${terms.map((term) => `upper(work_desc) LIKE '%${term.replace(/'/g, "''")}%'`).join(' OR ')})`
		: null;
	const where = [`issue_date BETWEEN '${isoNoZ(start)}' AND '${isoNoZ(end)}'`, likeBlock].filter(Boolean).join(' AND ');
	const select = [
		'permit_nbr',
		'issue_date',
		'work_desc',
		'permit_type',
		'permit_sub_type',
		'primary_address',
		'zip_code',
		'valuation',
		'lat',
		'lon',
	].join(',');

	const queryUrl = new URL(`/resource/${encodeURIComponent(dataset)}.json`, `https://${domain}`);
	queryUrl.searchParams.set('$select', select);
	queryUrl.searchParams.set('$where', where);
	queryUrl.searchParams.set('$order', 'issue_date DESC');
	queryUrl.searchParams.set('$limit', String(limit));

	let response;
	try {
		response = await fetch(queryUrl, { headers: env.SOC_APP_TOKEN ? { 'X-App-Token': env.SOC_APP_TOKEN } : {} });
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'upstream', detail: `fetch failed: ${e.message}`, url: String(queryUrl) }), {
			status: 502,
			headers: JSON_HEADERS,
		});
	}

	const text = await response.text();
	if (!response.ok) {
		return new Response(JSON.stringify({ ok: false, error: 'upstream', url: String(queryUrl), detail: text }), {
			status: 502,
			headers: JSON_HEADERS,
		});
	}

	let rows = [];
	try {
		rows = JSON.parse(text);
	} catch {}

	return new Response(
		JSON.stringify({
			ok: true,
			count: rows.length,
			count_1: String(rows.length),
			'count(*)': rows.length,
			total: rows.length,
			view: dataset,
			dataset,
			source_view: dataset,
			view_id: dataset,
			url: String(queryUrl),
			ui: `https://${domain}/resource/${dataset}`,
			rows,
			params: { trade, days, limit },
			...(debug ? { debug: { where, select, domain, dataset } } : {}),
		}),
		{ headers: JSON_HEADERS },
	);
}

async function handlePasadenaLive({ request, url }) {
	if (request.method !== 'GET') {
		return json(apiEnvelope(false, null, 'method_not_allowed'), 405);
	}

	const jurisdiction = getPasadenaJurisdiction();
	if (!jurisdiction) {
		return json(apiEnvelope(false, null, 'unknown_jurisdiction'), 400);
	}

	const q = (url.searchParams.get('q') || '').trim();
	const rawLimit = Number(url.searchParams.get('limit') || '25');
	const rawSinceDays = url.searchParams.get('since_days');
	const debug = url.searchParams.get('debug') === '1';
	const limit = !Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 100 ? 25 : rawLimit;
	const parsedSinceDays =
		rawSinceDays == null || rawSinceDays === '' ? null : Number(rawSinceDays);
	const sinceDays =
		parsedSinceDays == null || !Number.isFinite(parsedSinceDays) || parsedSinceDays <= 0
			? null
			: Math.min(parsedSinceDays, 3650);
	const fetchLimit = Math.max(limit * 8, 200);

	try {
		const { url: sourceUrl, features } = await fetchPasadenaArcgisFeatures({
			q,
			limit: fetchLimit,
			returnGeometry: true,
		});
		const results = features
			.map((feature) => normalizePasadenaLiveRecord(feature, jurisdiction))
			.filter((record) => record.id)
			.filter((record) => (q ? matchesHistoryQuery(record, q) : true))
			.filter((record) => isWithinSinceDays(record.updated_at || record.filed_at || record.issued_at, sinceDays))
			.slice(0, limit);

		return jsonWithCache(
			apiEnvelope(true, {
				jurisdiction: jurisdiction.id,
				query: {
					q,
					limit,
					since_days: sinceDays,
				},
				meta: {
					jurisdiction: jurisdiction.id,
					count: results.length,
					fetchLimit,
					source_url: sourceUrl,
					selected_endpoint: jurisdiction.provider.layerBaseUrl,
					secondary_endpoint: PASADENA_ACTIVE_BUILDING_PERMITS_LAYER_URL,
				},
				results,
				...(debug
					? {
							debug: {
								selected_endpoint: jurisdiction.provider.layerBaseUrl,
								secondary_endpoint: PASADENA_ACTIVE_BUILDING_PERMITS_LAYER_URL,
							},
						}
					: {}),
			}, null),
			200,
			60,
		);
	} catch (error) {
		return json(
			{
				ok: false,
				error: 'upstream',
				detail: String(error?.message || error),
				meta: buildPortalMeta(jurisdiction),
			},
			502,
		);
	}
}

async function handlePilotIntake({ request, env }) {
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'method_not_allowed' }, 405);
	}

	let data;
	try {
		data = await request.json();
	} catch {
		return json({ ok: false, error: 'bad_json' }, 400);
	}

	const required = ['name', 'company', 'phone', 'email'];
	const missing = required.filter((key) => !String(data[key] || '').trim());
	if (missing.length) {
		return json({ ok: false, error: `missing:${missing.join(',')}` }, 400);
	}

	const payload = {
		...data,
		receivedAt: new Date().toISOString(),
		ua: request.headers.get('user-agent') || '',
	};

	try {
		await env.PILOT_KV.put(`pilot:${payload.email}:${Date.now()}`, JSON.stringify(payload), {
			expirationTtl: 60 * 60 * 24 * 90,
		});
	} catch (e) {}

	if (env.FORWARD_TO && !isSelfFetchTarget(env.FORWARD_TO)) {
		try {
			await fetch(env.FORWARD_TO, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
			});
		} catch (e) {}
	}

	return json({ ok: true });
}

async function handleV1Jurisdictions() {
	return json({
		ok: true,
		jurisdictions: JURISDICTIONS
			.filter((jurisdiction) => jurisdiction.enabled !== false)
			.map(({ id, name, state, placeholder, enabled, provider, platform, portalUrl, portalNotes }) => ({
				id,
				name,
				state: state || null,
				placeholder,
				enabled: enabled === true,
				providerAvailable: Boolean(provider),
				platform: platform || null,
				portalUrl: portalUrl || null,
				portalNotes: portalNotes || null,
			})),
	});
}

async function handleV1HistorySearch({ request, url, env, ctx }) {
	if (request.method !== 'GET') {
		return json(apiEnvelope(false, null, 'method_not_allowed'), 405);
	}

	const jurisdictionId = (url.searchParams.get('jurisdiction') || '').trim();
	if (!jurisdictionId) {
		return json(apiEnvelope(false, null, 'jurisdiction_required'), 400);
	}

	const jurisdiction = findJurisdiction(jurisdictionId);
	if (!jurisdiction || jurisdiction.enabled === false) {
		return json(apiEnvelope(false, null, 'unknown_jurisdiction'), 400);
	}
	if (!jurisdiction.provider) {
		return jsonWithCache(apiEnvelope(true, {
			jurisdiction: jurisdiction.id,
			query: {
				q: (url.searchParams.get('q') || '').trim(),
				days: Number(url.searchParams.get('days') || '30'),
				minVal: Number(url.searchParams.get('minVal') || '0'),
				limit: Number(url.searchParams.get('limit') || '25'),
			},
			meta: buildPortalMeta(jurisdiction),
			results: [],
		}, null));
	}
	if (!['socrata', 'arcgis', 'ckan'].includes(jurisdiction.provider.type)) {
		return json(apiEnvelope(false, null, 'unknown_jurisdiction'), 400);
	}

	const q = (url.searchParams.get('q') || '').trim();
	const rawDays = Number(url.searchParams.get('days') || '30');
	const rawMinVal = Number(url.searchParams.get('minVal') || '0');
	const rawLimit = Number(url.searchParams.get('limit') || '25');
	const days = !Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 365 ? 30 : rawDays;
	const minVal = !Number.isFinite(rawMinVal) || rawMinVal < 0 ? 0 : rawMinVal;
	const limit = !Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 100 ? 25 : rawLimit;
	const fetchLimit = Math.max(limit * 10, 200);

	const cacheUrl = new URL(url.toString());
	cacheUrl.searchParams.sort();
	const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
	const cache = caches.default;
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached;
	}

	try {
		const { url: sourceUrl, rows } = await fetchHistoryRows(env, jurisdiction, { q, fetchLimit });

		const results = (Array.isArray(rows) ? rows : [])
			.map((row) => normalizeHistoryRecord(row, jurisdiction))
			.filter((record) =>
				shouldIncludeHistoryRecord(record, q, days, minVal, {
					applyQueryFilter: jurisdiction.provider.type !== 'arcgis',
				})
			)
			.slice(0, limit);

		const response = jsonWithCache(apiEnvelope(true, {
			jurisdiction: jurisdiction.id,
			query: {
				q,
				days,
				minVal,
				limit,
			},
			meta: {
				jurisdiction: jurisdiction.id,
				count: results.length,
				fetchLimit,
				source_url: sourceUrl,
			},
			results,
		}, null));

		if (ctx?.waitUntil) {
			ctx.waitUntil(cache.put(cacheKey, response.clone()));
		} else {
			await cache.put(cacheKey, response.clone());
		}
		return response;
	} catch (e) {
		const detail = e && e.message ? String(e.message) : 'upstream request failed';
		return json({ ok: false, error: 'upstream', detail, meta: buildPortalMeta(jurisdiction) }, 502);
	}
}

function createContext(request, env, ctx) {
	const url = new URL(request.url);
	return {
		request,
		env,
		ctx,
		url,
		pathname: normalizePathname(url.pathname),
	};
}

function createRoutes() {
	return {
		'/health': handleHealth,
		'/live/pasadena': handlePasadenaLive,
		'/api/health': handleHealth,
		'/api/radar': handleRadar,
		'/api/top': handleTopPermits,
		'/api/top-permits': handleTopPermits,
		'/api/address-pulse': handleAddressPulse,
		'/api/mission-control/report': handleMissionControlReport,
		'/api/zone-claim': ({ url, env }) => handleZoneClaim(url, env),
		'/api/pilot-intake': handlePilotIntake,
		'/pilot-intake': handlePilotIntake,
		'/v1/health': handleHealth,
		'/v1/jurisdictions': handleV1Jurisdictions,
		'/v1/history/search': handleV1HistorySearch,
	};
}

async function dispatchRoute(context) {
	const routes = createRoutes();
	const handler = routes[context.pathname];
	if (!handler) {
		return withCors(context.request, json({ ok: false, error: 'not_found' }, 404));
	}

	return withCors(context.request, await handler(context));
}

export default {
	async fetch(request, env, ctx) {
		try {
			if (request.method === 'OPTIONS') {
				return preflightResponse(request.headers.get('Origin') || '');
			}

			return await dispatchRoute(createContext(request, env, ctx));
		} catch (e) {
			return err('exception', e.message);
		}
	},
};
