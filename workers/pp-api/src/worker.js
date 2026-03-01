// pp-api — "ultimate" worker for Radar + Top Permits (LA)
// Runtime: Cloudflare Workers (Modules)

// --- CORS helpers ---
const ALLOWED_ORIGINS = [
	'https://getpermitpulse.com',
	'https://www.getpermitpulse.com',
	// add your Pages preview if you use it:
	// 'https://<your-pages-project>.pages.dev'
];

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

function withCors(req, resp) {
	const h = new Headers(resp.headers);
	const ch = corsHeaders(req.headers.get('Origin') || '');
	Object.entries(ch).forEach(([k, v]) => h.set(k, v));
	return new Response(resp.body, { status: resp.status, headers: h });
}

// Keep your json()/err() helpers if you have them – no need to modify them.

const json = (obj, status = 200, extra = {}, req) =>
	new Response(JSON.stringify(obj), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			...corsHeaders(req?.headers.get('Origin') || ''),
			...extra,
		},
	});

const err = (message, detail = null, status = 500) => json({ ok: false, error: message, detail }, status);

// collapse whitespace in multiline SoQL
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

// ISO helpers
const nowUtc = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const toISO = (d) => d.toISOString();

//// extra time helpers
const daysAgoUtc = (n) => {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0); // midnight UTC
	d.setUTCDate(d.getUTCDate() - n);
	return d;
};

// aliases so handler names always resolve

const toIsoDate = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// normalize a row into our API shape
function mapRow(row, env) {
	const permit = row.pcis_permit ?? row.permit_nbr ?? row.permit ?? row.permit_number ?? null;

	const issued_at = row.issue_date || row.issued_date || null;

	const description = row.work_description ?? row.work_desc ?? row.description ?? '';

	const type = row.permit_type ?? row.type ?? null;
	const subtype = row.permit_sub_type ?? row.subtype ?? null;

	// address
	const fullA = row.full_address;
	const fullB = row.primary_address;

	// A-shape parts
	const aParts = [row.address_start, row.street_direction, row.street_name, row.street_suffix].filter(Boolean).join(' ');

	const city = env.CITY_NAME || 'Los Angeles';
	const state = env.STATE_ABBR || 'CA';
	const zip = row.zip_code || row.zip || null;

	const address = fullA || fullB || (aParts ? `${aParts}, ${city}, ${state} ${zip ?? ''}`.trim() : null);

	const valuation = row.valuation != null ? Number(row.valuation) : null;

	return {
		permit,
		issued_at,
		type,
		subtype,
		description,
		address,
		zip,
		valuation,
	};
}

// keywords per trade
const TRADE = {
	roof: ['ROOF', 'REROOF', 'RE-ROOF'],
	solar: ['SOLAR', 'PHOTOVOLTAIC', 'PV'],
	hvac: ['HVAC', 'FURNACE', 'AIR CONDITION', 'A/C', 'AIR-CONDITION'],
};

function keywordsWhere(field, words) {
	if (!words?.length) return '1=1';
	const ups = words.map((w) => `upper(${field}) LIKE '%${w.toUpperCase().replace(/'/g, "''")}%'`);
	return `(${ups.join(' OR ')})`;
}

function buildWhereRadar({ fromISO, toISO, trade }) {
	// Support both work_description (A) and work_desc (B)
	const words = TRADE[trade] ?? TRADE.roof;
	const wA = keywordsWhere('work_description', words);
	const wB = keywordsWhere('work_desc', words);
	return oneLine(`
                                                                                                                                                                                                issue_date BETWEEN '${fromISO}' AND '${toISO}'
                                                                                                                                                                                                    AND ( ${wA} OR ${wB} )
                                                                                                                                                                                                      `);
}

function buildWhereTop({ fromISO, toISO, minVal }) {
	// valuation numeric is shared
	return oneLine(`
                                                                                                                                                                                                              issue_date BETWEEN '${fromISO}' AND '${toISO}'
                                                                                                                                                                                                                  AND valuation >= ${Number(minVal)}
                                                                                                                                                                                                                    `);
}

function qs(params) {
	const usp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null && v !== '') usp.set(k, v);
	}
	return usp.toString();
}

// Socrata fetch with optional app token
async function sodaFetch(env, q) {
	const base = `https://${env.SOC_DOMAIN}/resource/${env.SOC_DATASET}.json`;
	const url = `${base}?${q}`;
	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) headers['X-App-Token'] = env.SOC_APP_TOKEN;

	const r = await fetch(url, { headers });
	if (!r.ok) {
		const t = await r.text().catch(() => '');
		const detail = t || `status ${r.status}`;
		throw new Error(`upstream ${r.status}: ${detail}`);
	}
	const rows = await r.json();
	return { url, rows };
}

// Try A-shape first, then B-shape if A fails due to unknown columns.
// We keep the WHERE identical across both; only $select changes.
async function sodaFetchWithFallback(env, paramsA, paramsB) {
	try {
		return { ...(await sodaFetch(env, paramsA())), used: 'A' };
	} catch (e) {
		// only fallback for column errors or 400s; but in practice we'll fallback for any failure
		return { ...(await sodaFetch(env, paramsB())), used: 'B' };
	}
}

/* ---------- handlers ---------- */

// --- helper: top permits (pull-then-filter; no $where) ----------------
async function handleTopPermits(url, env) {
	const search = url.searchParams;

	// Query params with sane defaults
	const rawDays = Number(search.get('days') || '30');
	const rawMin = Number(search.get('min') || '250000');
	const rawLimit = Number(search.get('limit') || '25');
	const trade = (search.get('trade') || 'roof').toLowerCase();
	const debug = search.get('debug') === '1';
	const mode = (search.get('mode') || 'normal').toLowerCase();

	const days = !Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 365 ? 30 : rawDays;
	const minValue = !Number.isFinite(rawMin) || rawMin < 0 ? 0 : rawMin;
	const limit = !Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 200 ? 25 : rawLimit;

	// LADBS dataset + fields (all TEXT in the schema)
	const dataset = 'pi9x-tg5x';
	const domain = 'data.lacity.org';

	const filedField = 'issue_date';
	const valField = 'valuation';
	const permitField = 'permit_nbr';
	const zipField = 'zip_code';
	const addrField = 'primary_address';
	const descField = 'work_desc';

	// We'll fetch more rows than we ultimately need, then filter in JS
	const fetchLimit = Math.max(limit * 5, 500); // e.g. 500+

	const socUrl = new URL(`https://${domain}/resource/${dataset}.json`);
	// Only order + limit, NO $where to avoid type-mismatch
	socUrl.searchParams.set('$order', `${filedField} DESC`);
	socUrl.searchParams.set('$limit', String(fetchLimit));

	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) {
		headers['X-App-Token'] = env.SOC_APP_TOKEN;
	}

	let status = 200;
	let error = null;
	let raw = [];
	let errorDetail = null;

	try {
		const resp = await fetch(socUrl.toString(), { headers });

		if (!resp.ok) {
			status = 502;
			error = `ladbs_fetch_failed_${resp.status}`;
			const text = await resp.text();
			errorDetail = text;
			try {
				raw = JSON.parse(text);
			} catch {
				raw = [];
			}
		} else {
			raw = await resp.json();
		}
	} catch (e) {
		status = 502;
		error = 'ladbs_fetch_exception';
		errorDetail = e && e.message ? String(e.message) : String(e);
		raw = [];
	}

	// Helper to parse LADBS ISSUE_DATE into a Date
	// Dataset uses ISO timestamps like "2024-12-09T00:00:00"
	function parseIssueDate(str) {
		if (!str) return null;
		const s = String(str);

		// 1) Try native Date parse (handles ISO "YYYY-MM-DDTHH:MM:SS")
		const dIso = new Date(s);
		if (!Number.isNaN(dIso.getTime())) return dIso;

		// 2) Fallback: try MM/DD/YYYY or YYYY-MM-DD
		const parts = s.split(/[/-]/);
		if (parts.length === 3) {
			let [a, b, c] = parts;
			if (a.length === 4) {
				// YYYY-MM-DD
				const d = new Date(Number(a), Number(b) - 1, Number(c));
				if (!Number.isNaN(d.getTime())) return d;
			} else {
				// MM/DD/YYYY
				const d = new Date(Number(c), Number(a) - 1, Number(b));
				if (!Number.isNaN(d.getTime())) return d;
			}
		}

		return null;
	}

	// Helper to parse valuation text into a Number
	function parseValuation(str) {
		if (str == null) return 0;
		const clean = String(str).replace(/[^0-9.]/g, '');
		const n = parseFloat(clean);
		return Number.isFinite(n) ? n : 0;
	}

	const now = new Date();
	const minTime = now.getTime() - days * 24 * 60 * 60 * 1000;

	// Trade + storm filter helper used by /api/top-permits and other routes
	function matchesTrade(desc, trade, mode) {
		const s = (desc || '').toLowerCase();
		const t = (trade || '').toLowerCase();
		const m = (mode || 'normal').toLowerCase();

		if (!s) return false;

		// ---- Roofing ----
		if (t === 'roof') {
			const basicRoof = s.includes('roof') || s.includes('reroof') || s.includes('re-roof') || s.includes('re roof');

			if (!basicRoof) return false;

			// Storm mode: leak / emergency / storm-damage language
			if (m === 'storm') {
				const stormWords = [
					'leak',
					'roof leak',
					'water damage',
					'storm',
					'wind damage',
					'emergency',
					'temporary repair',
					'tarp',
					'tarps',
					'dry out',
					'dry-out',
					'repair existing roof',
				];
				return stormWords.some((w) => s.includes(w));
			}

			// Normal roofing: any roof job is fine
			return true;
		}

		// ---- Solar ----
		if (t === 'solar') {
			return s.includes('solar') || s.includes('pv') || s.includes('photovoltaic') || s.includes('photovoltaics');
		}

		// ---- HVAC ----
		if (t === 'hvac') {
			return s.includes('hvac') || s.includes('furnace') || s.includes('air conditioning') || s.includes('a/c') || s.includes('heat pump');
		}

		// ---- Additions / ADU-ish ----
		if (t === 'addition') {
			return s.includes('addition') || s.includes('addn') || s.includes('adu') || s.includes('garage conversion');
		}

		// ---- Electrical ----
		if (t === 'electrical') {
			return s.includes('electrical') || s.includes('service upgrade') || s.includes('panel') || s.includes('main switchboard');
		}

		// Fallback: if trade is unknown, let it through
		return true;
	}

	const rows = Array.isArray(raw) ? raw : [];

	// Map + filter in JS
	const filtered = rows
		.map((row) => {
			const issueDateStr = row[filedField] || null;
			const issueDateObj = parseIssueDate(issueDateStr);
			const value = parseValuation(row[valField]);
			const description = row[descField] || row.work_description || row.description || null;
			const address = row[addrField] || row.address || '';
			const zip = row[zipField] || null;
			const permitNumber = row[permitField] || null;

			return {
				permitNumber,
				issueDate: issueDateStr,
				issueDateObj,
				address,
				zip,
				value,
				description,
			};
		})
		.filter((p) => {
			if (!p.issueDateObj) return false;
			if (p.issueDateObj.getTime() < minTime) return false;
			if (p.value < minValue) return false;
			if (!matchesTrade(p.description, trade, mode)) return false;
			return true;
		})
		.sort((a, b) => b.value - a.value)
		.slice(0, limit)
		.map((p) => ({
			permitNumber: p.permitNumber,
			issueDate: p.issueDate,
			address: p.address,
			zip: p.zip,
			value: p.value,
			description: p.description,
			trade,
		}));

	const body = {
		ok: !error,
		meta: {
			days,
			minValue,
			limit,
			trade,
			source: `LADBS permits via https://${domain}/resource/${dataset}`,
			error,
			count: filtered.length,
		},
		permits: filtered,
		debug: debug
			? {
					socUrl: socUrl.toString(),
					fetchedRows: rows.length,
					errorDetail,
				}
			: undefined,
	};

	return json(body, error ? status : 200);
}
// --- end helper --------------------------------------------------------
// --- helper: Address Pulse Check --------------------------------------
async function handleAddressPulse(url, env) {
	const search = url.searchParams;
	const q = (search.get('q') || '').trim();
	const zipFilter = (search.get('zip') || '').trim();
	const rawYears = Number(search.get('years') || '3');
	const debug = search.get('debug') === '1';

	const years = !Number.isFinite(rawYears) || rawYears <= 0 || rawYears > 10 ? 3 : rawYears;
	const days = years * 365;

	const dataset = 'pi9x-tg5x';
	const domain = 'data.lacity.org';

	const filedField = 'issue_date';
	const valField = 'valuation';
	const permitField = 'permit_nbr';
	const zipField = 'zip_code';
	const addrField = 'primary_address';
	const descField = 'work_desc';

	const fetchLimit = 2000;

	const socUrl = new URL(`https://${domain}/resource/${dataset}.json`);
	socUrl.searchParams.set('$order', `${filedField} DESC`);
	socUrl.searchParams.set('$limit', String(fetchLimit));

	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) headers['X-App-Token'] = env.SOC_APP_TOKEN;

	let status = 200;
	let error = null;
	let raw = [];
	let errorDetail = null;

	try {
		const resp = await fetch(socUrl.toString(), { headers });
		if (!resp.ok) {
			status = 502;
			error = `ladbs_fetch_failed_${resp.status}`;
			const text = await resp.text();
			errorDetail = text;
			try {
				raw = JSON.parse(text);
			} catch {
				raw = [];
			}
		} else {
			raw = await resp.json();
		}
	} catch (e) {
		status = 502;
		error = 'ladbs_fetch_exception';
		errorDetail = e && e.message ? String(e.message) : String(e);
		raw = [];
	}

	function parseIssueDate(str) {
		if (!str) return null;
		const s = String(str);
		const dIso = new Date(s);
		if (!Number.isNaN(dIso.getTime())) return dIso;
		const parts = s.split(/[/-]/);
		if (parts.length === 3) {
			let [a, b, c] = parts;
			if (a.length === 4) {
				const d = new Date(Number(a), Number(b) - 1, Number(c));
				if (!Number.isNaN(d.getTime())) return d;
			} else {
				const d = new Date(Number(c), Number(a) - 1, Number(b));
				if (!Number.isNaN(d.getTime())) return d;
			}
		}
		return null;
	}

	function parseValuation(str) {
		if (str == null) return 0;
		const clean = String(str).replace(/[^0-9.]/g, '');
		const n = parseFloat(clean);
		return Number.isFinite(n) ? n : 0;
	}

	const now = new Date();
	const minTime = now.getTime() - days * 24 * 60 * 60 * 1000;
	const rows = Array.isArray(raw) ? raw : [];

	const qLower = q.toLowerCase();

	const permits = rows
		.map((row) => {
			const issueDateStr = row[filedField] || null;
			const issueDateObj = parseIssueDate(issueDateStr);
			const value = parseValuation(row[valField]);
			const address = row[addrField] || row.address || '';
			const zip = row[zipField] || null;
			const permitNumber = row[permitField] || null;
			const description = row[descField] || row.work_description || row.description || null;

			return {
				permitNumber,
				issueDate: issueDateStr,
				issueDateObj,
				address,
				zip,
				value,
				description,
			};
		})
		.filter((p) => {
			if (!p.issueDateObj) return false;
			if (p.issueDateObj.getTime() < minTime) return false;

			if (zipFilter && p.zip !== zipFilter) return false;

			if (qLower) {
				const addr = (p.address || '').toLowerCase();
				const permitStr = String(p.permitNumber || '').toLowerCase();
				if (!addr.includes(qLower) && !permitStr.includes(qLower)) {
					return false;
				}
			}

			return true;
		})
		.sort((a, b) => b.issueDateObj - a.issueDateObj)
		.slice(0, 200);

	const body = {
		ok: !error,
		meta: {
			q,
			zip: zipFilter,
			years,
			days,
			source: `LADBS permits via https://${domain}/resource/${dataset}`,
			error,
			count: permits.length,
		},
		permits: permits.map((p) => ({
			permitNumber: p.permitNumber,
			issueDate: p.issueDate,
			address: p.address,
			zip: p.zip,
			value: p.value,
			description: p.description,
		})),
		debug: debug
			? {
					socUrl: socUrl.toString(),
					fetchedRows: rows.length,
					errorDetail,
				}
			: undefined,
	};

	return json(body, error ? status : 200);
}

async function handleHealth(env) {
	try {
		// cheap ping
		const q = qs({ $select: 'count(1)' });
		const { url, rows } = await sodaFetch(env, q);
		return json({ ok: true, dataset: env.SOC_DATASET, url, rows });
	} catch (e) {
		return err('upstream', e.message);
	}
}

//// Accepts Request | URL | string
async function handleRadar(reqOrUrl, env) {
	// --- normalize to URL ---
	const toURL = (x) => {
		try {
			if (x instanceof URL) return x;
			if (x && typeof x.url === 'string') return new URL(x.url);
			if (typeof x === 'string') return new URL(x);
		} catch (_) {}
		return null;
	};
	const urlObj = toURL(reqOrUrl);
	if (!urlObj) {
		return new Response(JSON.stringify({ ok: false, error: 'bad_request', detail: 'Bad request URL' }), {
			status: 400,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		});
	}

	// --- env cleanup ---
	const DOMAIN = ((env.SOC_DOMAIN || 'data.lacity.org') + '')
		.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/\/+$/, '');
	const DATASET = ((env.SOC_DATASET || 'pi9x-tg5x') + '').trim();

	// --- params ---
	const sp = urlObj.searchParams;
	const trade = (sp.get('trade') || 'roof').toLowerCase();
	const days = Math.max(1, Math.min(parseInt(sp.get('days') || '7', 10), 30));
	const limit = Math.max(1, Math.min(parseInt(sp.get('limit') || '50', 10), 200));
	const debug = sp.has('debug');

	const end = new Date();
	const start = new Date(end.getTime() - days * 86400000);
	const isoNoZ = (d) => d.toISOString().replace('Z', '');

	// keywords go against work_desc in this dataset
	const KW = {
		roof: ['ROOF', 'REROOF', 'RE-ROOF'],
		solar: ['SOLAR', 'PHOTOVOLTAIC', 'PV'],
		hvac: ['HVAC', 'MECHANICAL', 'A/C', 'AC'],
		general: [],
	};
	const terms = KW[trade] || KW.roof;

	// --- SOCQL ----
	const likeBlock = terms.length ? '(' + terms.map((t) => `upper(work_desc) LIKE '%${t.replace(/'/g, "''")}%'`).join(' OR ') + ')' : null;

	const where = [`issue_date BETWEEN '${isoNoZ(start)}' AND '${isoNoZ(end)}'`, likeBlock].filter(Boolean).join(' AND ');

	// Use real column names from pi9x-tg5x
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

	const q = new URL(`/resource/${encodeURIComponent(DATASET)}.json`, `https://${DOMAIN}`);
	q.searchParams.set('$select', select);
	q.searchParams.set('$where', where);
	q.searchParams.set('$order', 'issue_date DESC');
	q.searchParams.set('$limit', String(limit));

	const headers = env.SOC_APP_TOKEN ? { 'X-App-Token': env.SOC_APP_TOKEN } : {};
	let resp;
	try {
		resp = await fetch(q, { headers });
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'upstream', detail: `fetch failed: ${e.message}`, url: String(q) }), {
			status: 502,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		});
	}

	const text = await resp.text();
	if (!resp.ok) {
		return new Response(JSON.stringify({ ok: false, error: 'upstream', url: String(q), detail: text }), {
			status: 502,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		});
	}

	let rows = [];
	try {
		rows = JSON.parse(text);
	} catch {}
	return new Response(
		JSON.stringify({
			ok: true,

			// ---- counters (cover all legacy names) ----
			count: rows.length, // preferred
			count_1: String(rows.length), // legacy Socrata aggregate
			'count(*)': rows.length, // another legacy name
			total: rows.length, // belt & suspenders

			// ---- dataset / view aliases ----
			view: DATASET, // what the UI likely reads
			dataset: DATASET, // alt
			source_view: DATASET, // alt
			view_id: DATASET, // alt

			// ---- links ----
			url: String(q), // JSON API link (already works)
			ui: `https://${DOMAIN}/resource/${DATASET}`, // human Socrata UI

			// ---- data + echo params ----
			rows,
			params: { trade, days, limit },

			// ---- optional debug ----
			...(debug ? { debug: { where, select, domain: DOMAIN, dataset: DATASET } } : {}),
		}),
		{
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			},
		},
	);
}

/// --- TOP PERMITS

export default {
	async fetch(request, env) {
		try {
			// ---- CORS preflight
			if (request.method === 'OPTIONS') {
				return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || '') });
			}

			// normalize path (strip trailing slash except for root)
			const url = new URL(request.url);
			const rawPath = url.pathname;
			const pathname = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

			// CORS preflight (keep if you had this already)
			if (request.method === 'OPTIONS') {
				return new Response('', {
					headers: {
						'access-control-allow-origin': '*',
						'access-control-allow-methods': 'GET, POST, OPTIONS',
						'access-control-allow-headers': 'content-type',
					},
				});
			}

			// ---- routes ----
			if (pathname === '/api/health') return withCors(request, await handleHealth(env));
			if (pathname === '/api/radar') return withCors(request, await handleRadar(url, env));
			if (pathname === '/api/top' || pathname === '/api/top-permits') return withCors(request, await handleTopPermits(url, env));
			if (pathname === '/api/address-pulse') return withCors(request, await handleAddressPulse(url, env));

			if (pathname === '/api/zone-claim') return withCors(request, await handleZoneClaim(url, env));

			// --- Pilot Intake ---
			if (pathname === '/api/pilot-intake' || pathname === '/pilot-intake') {
				// CORS preflight
				if (request.method === 'OPTIONS') {
					return new Response(null, { headers: { ...corsHeaders(request.headers.get('Origin') || '') } });
				}

				if (request.method !== 'POST') {
					return withCors(request, json({ ok: false, error: 'method_not_allowed' }, 405));
				}

				// Parse + validate
				let data;
				try {
					data = await request.json();
				} catch {
					return withCors(request, json({ ok: false, error: 'bad_json' }, 400));
				}

				const required = ['name', 'company', 'phone', 'email'];
				const missing = required.filter((k) => !String(data[k] || '').trim());
				if (missing.length) {
					return withCors(request, json({ ok: false, error: 'missing:' + missing.join(',') }, 400));
				}

				const payload = {
					...data,
					receivedAt: new Date().toISOString(),
					ua: request.headers.get('user-agent') || '',
				};

				// Optional: backup to KV for 90 days
				try {
					await env.PILOT_KV.put(`pilot:${payload.email}:${Date.now()}`, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 90 });
				} catch (e) {}

				// Optional: forward to webhook/email service
				if (env.FORWARD_TO) {
					try {
						await fetch(env.FORWARD_TO, {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(payload),
						});
					} catch (e) {}
				}

				return withCors(request, json({ ok: true }));
			}

			// 404
			return withCors(request, json({ ok: false, error: 'not_found' }, 404));
		} catch (e) {
			return err('exception', e.message);
		}
	},
};
