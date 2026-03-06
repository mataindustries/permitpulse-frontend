function buildArcgisUrl(layerBaseUrl) {
	if (!layerBaseUrl || !/^https?:\/\//i.test(layerBaseUrl)) {
		throw new Error('Invalid layerBaseUrl');
	}

	const base = layerBaseUrl.replace(/\/query\b.*$/, '').replace(/\/+$/, '');
	return new URL(`${base}/query`);
}

export async function arcgisQuery({
	layerBaseUrl,
	outFields = '*',
	orderByFields,
	where = '1=1',
	limit = 200,
	offset = 0,
	signal,
}) {
	let url;
	try {
		url = buildArcgisUrl(layerBaseUrl);
	} catch (error) {
		return {
			ok: false,
			status: 400,
			url: String(layerBaseUrl || ''),
			errorText: error.message,
		};
	}

	url.searchParams.set('f', 'json');
	url.searchParams.set('where', where || '1=1');
	url.searchParams.set('outFields', outFields);
	url.searchParams.set('returnGeometry', 'false');
	url.searchParams.set('resultRecordCount', String(limit));
	url.searchParams.set('resultOffset', String(offset));
	if (orderByFields) {
		url.searchParams.set('orderByFields', orderByFields);
	}

	let response;
	let text;
	try {
		response = await fetch(url.toString(), { signal });
		text = await response.text();
	} catch (error) {
		return {
			ok: false,
			status: 502,
			url: url.toString(),
			errorText: String(error?.message || error),
		};
	}

	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			url: url.toString(),
			errorText: text,
		};
	}

	let data;
	try {
		data = JSON.parse(text);
	} catch {
		return {
			ok: false,
			status: 502,
			url: url.toString(),
			errorText: 'ArcGIS returned invalid JSON',
		};
	}

	if (data?.error) {
		return {
			ok: false,
			status: 502,
			url: url.toString(),
			errorText: JSON.stringify(data.error),
		};
	}

	return {
		ok: true,
		url: url.toString(),
		features: Array.isArray(data.features) ? data.features : [],
	};
}
