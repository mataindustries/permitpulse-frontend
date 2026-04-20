function normalizeFieldName(field) {
	return String(field || '')
		.trim()
		.split('.')[0];
}

function buildSelectClause(provider) {
	const fields = Object.values(provider.fields || {})
		.filter(Boolean)
		.map(normalizeFieldName)
		.filter(Boolean);
	return [...new Set(fields)].join(',');
}

function createSocrataHeaders(env) {
	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) {
		headers['X-App-Token'] = env.SOC_APP_TOKEN;
	}
	return headers;
}

export function buildHistoryQuery(provider, { fetchLimit }) {
	const query = new URLSearchParams();
	const orderField = normalizeFieldName(
		provider?.fields?.updated_at || provider?.fields?.filed_at || provider?.fields?.issued_at,
	);
	if (provider?.omitSelect !== true) {
		query.set('$select', buildSelectClause(provider));
	}
	if (orderField) {
		query.set('$order', `${orderField} DESC`);
	}
	query.set('$limit', String(fetchLimit));
	return query.toString();
}

export function buildSocrataUrl(provider, query) {
	return `https://${provider.domain}/resource/${provider.dataset}.json?${query}`;
}

export async function fetchSocrataRows(env, provider, params) {
	const query = buildHistoryQuery(provider, params);
	const url = buildSocrataUrl(provider, query);
	const response = await fetch(url, { headers: createSocrataHeaders(env) });

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`upstream ${response.status}: ${detail || 'request failed'}`);
	}

	return {
		url,
		rows: await response.json(),
	};
}
