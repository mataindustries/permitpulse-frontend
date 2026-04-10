import { JURISDICTIONS } from '../workers/pp-api/src/config/jurisdictions.js';

const BATCH_IDS = [
  'new_york_city',
  'chicago',
  'houston',
  'phoenix',
  'philadelphia',
  'san_antonio',
  'dallas',
  'san_jose',
  'austin',
  'jacksonville',
  'fort_worth',
  'columbus',
  'charlotte',
  'indianapolis',
  'san_francisco',
  'seattle',
  'denver',
  'washington_dc',
  'miami',
  'raleigh',
];

function buildApiProbe(entry) {
  if (!entry.provider) return null;

  if (entry.provider.type === 'socrata') {
    return `https://${entry.provider.domain}/resource/${entry.provider.dataset}.json?$limit=1`;
  }

  if (entry.provider.type === 'arcgis') {
    const url = new URL(`${entry.provider.layerBaseUrl.replace(/\/query\b.*$/, '')}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('returnGeometry', 'false');
    url.searchParams.set('resultRecordCount', '1');
    url.searchParams.set('f', 'json');
    return url.toString();
  }

  if (entry.provider.type === 'ckan') {
    const url = new URL(
      entry.provider.baseUrl ||
      (entry.provider.domain
        ? `https://${entry.provider.domain}/api/3/action/datastore_search`
        : '/api/3/action/datastore_search')
    );
    url.searchParams.set('resource_id', entry.provider.resourceId || entry.provider.resource_id);
    url.searchParams.set('limit', '1');
    return url.toString();
  }

  return null;
}

async function probeUrl(target, options = {}) {
  if (!target) {
    return { ok: false, status: 0, detail: 'missing_url' };
  }

  const headers = Object.assign(
    {
      'User-Agent': 'Mozilla/5.0 (compatible; PermitPulseVerifier/1.0; +https://getpermitpulse.com/)',
      Accept: '*/*',
    },
    options.headers || {}
  );

  try {
    let response = await fetch(target, {
      method: options.method || 'HEAD',
      redirect: 'follow',
      headers,
    });

    if ((response.status === 405 || response.status === 403) && (options.method || 'HEAD') === 'HEAD') {
      response = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        headers,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType,
      detail: response.ok ? 'ok' : `http_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error && error.message ? String(error.message) : 'fetch_failed',
    };
  }
}

async function verifyEntry(entry) {
  const portal = await probeUrl(entry.portalUrl);
  const apiUrl = buildApiProbe(entry);
  const api = apiUrl ? await probeUrl(apiUrl, { method: 'GET', headers: { Accept: 'application/json' } }) : null;

  const tier = entry.provider ? 'api_backed' : 'portal_only';
  let group = tier;
  if (!portal.ok || (apiUrl && (!api || !api.ok))) {
    group = 'failed_review';
  }

  return {
    id: entry.id,
    name: entry.name,
    tier,
    group,
    platform: entry.platform || null,
    portalUrl: entry.portalUrl || null,
    portalStatus: portal.status,
    portalDetail: portal.detail,
    portalFinalUrl: portal.finalUrl || null,
    apiUrl,
    apiStatus: api ? api.status : null,
    apiDetail: api ? api.detail : null,
    apiFinalUrl: api ? api.finalUrl || null : null,
  };
}

function printGroup(label, items) {
  console.log(`\n## ${label}`);
  if (!items.length) {
    console.log('- none');
    return;
  }

  for (const item of items) {
    const portalLine = `${item.name} (${item.id}) | portal=${item.portalStatus}:${item.portalDetail}`;
    const apiLine = item.apiUrl
      ? ` | api=${item.apiStatus}:${item.apiDetail} | api_url=${item.apiUrl}`
      : '';
    console.log(`- ${portalLine}${apiLine}`);
  }
}

async function main() {
  const batch = BATCH_IDS.map((id) => JURISDICTIONS.find((entry) => entry.id === id)).filter(Boolean);
  const missing = BATCH_IDS.filter((id) => !batch.find((entry) => entry.id === id));

  if (missing.length) {
    console.error(`Missing batch entries: ${missing.join(', ')}`);
    process.exit(1);
  }

  const results = [];
  for (const entry of batch) {
    results.push(await verifyEntry(entry));
  }

  printGroup('api_backed', results.filter((item) => item.group === 'api_backed'));
  printGroup('portal_only', results.filter((item) => item.group === 'portal_only'));
  printGroup('failed_review', results.filter((item) => item.group === 'failed_review'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
