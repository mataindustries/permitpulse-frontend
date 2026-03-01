function buildSelectClause(provider) {
	const fields = Object.values(provider.fields).filter(Boolean);
	return [...new Set(fields)].join(',');
}

function createSocrataHeaders(env) {
	const headers = { Accept: 'application/json' };
	if (env.SOC_APP_TOKEN) {
		headers['X-App-Token'] = env.SOC_APP_TOKEN;
	}
	return headers;
}

export function buildHistoryQuery(provider, { q, fetchLimit }) {
	const query = new URLSearchParams();
	query.set('$select', buildSelectClause(provider));
	query.set('$order', `${provider.fields.filed_at} DESC`);
	query.set('$limit', String(fetchLimit));
	if (q) {
		query.set('$q', q);
	}
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
