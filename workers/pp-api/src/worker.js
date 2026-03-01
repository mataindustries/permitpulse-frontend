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
import { fetchSocrataRows } from './providers/socrata.js';

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

function parseIssueDate(value) {
	if (!value) return null;

	const input = String(value);
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

function normalizeHistoryRecord(row, jurisdiction) {
	const fields = jurisdiction.provider.fields;
	const id = row[fields.id] || null;
	const address = row[fields.address] || null;
	const filedAt = row[fields.filed_at] || null;
	const valuation = row[fields.valuation] == null ? null : parseValuation(row[fields.valuation]);
	const description = String(row[fields.description] || '').toLowerCase();
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

	const sourceUrl = id
		? `https://${jurisdiction.provider.domain}/resource/${jurisdiction.provider.dataset}.json?${new URLSearchParams({
				[jurisdiction.provider.fields.id]: id,
				$limit: '1',
			}).toString()}`
		: `https://${jurisdiction.provider.domain}/resource/${jurisdiction.provider.dataset}`;

	return {
		id,
		address,
		status: fields.status ? row[fields.status] || null : null,
		permit_type: row[fields.permit_type] || null,
		subtype: row[fields.subtype] || null,
		filed_at: filedAt,
		valuation,
		source_url: sourceUrl,
		risk_flags: riskFlags,
	};
}

function shouldIncludeHistoryRecord(record, days, minVal) {
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
		return false;
	}

	return record.valuation >= minVal;
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

async function handleHealth({ env }) {
	try {
		const query = qs({ $select: 'count(1)' });
		const { url, rows } = await sodaFetch(env, query);
		return json({ ok: true, dataset: env.SOC_DATASET, url, rows });
	} catch (e) {
		return err('upstream', e.message);
	}
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
	const trade = (search.get('trade') || 'roof').toLowerCase();
	const days = Math.max(1, Math.min(parseInt(search.get('days') || '7', 10), 30));
	const limit = Math.max(1, Math.min(parseInt(search.get('limit') || '50', 10), 200));
	const debug = search.has('debug');

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
		jurisdictions: JURISDICTIONS.map(({ id, name, placeholder }) => ({ id, name, placeholder })),
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
	if (!jurisdiction?.provider || jurisdiction.provider.type !== 'socrata') {
		return json(apiEnvelope(false, null, 'unknown_jurisdiction'), 400);
	}

	const q = (url.searchParams.get('q') || '').trim();
	const rawDays = Number(url.searchParams.get('days') || '30');
	const rawMinVal = Number(url.searchParams.get('minVal') || '250000');
	const rawLimit = Number(url.searchParams.get('limit') || '25');
	const days = !Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 365 ? 30 : rawDays;
	const minVal = !Number.isFinite(rawMinVal) || rawMinVal < 0 ? 250000 : rawMinVal;
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
		const { url: sourceUrl, rows } = await fetchSocrataRows(env, jurisdiction.provider, {
			q,
			limit,
			fetchLimit,
		});

		const results = (Array.isArray(rows) ? rows : [])
			.map((row) => normalizeHistoryRecord(row, jurisdiction))
			.filter((record) => shouldIncludeHistoryRecord(record, days, minVal))
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
		return json(apiEnvelope(false, null, `upstream: ${e.message}`), 502);
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
		'/api/health': handleHealth,
		'/api/radar': handleRadar,
		'/api/top': handleTopPermits,
		'/api/top-permits': handleTopPermits,
		'/api/address-pulse': handleAddressPulse,
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
