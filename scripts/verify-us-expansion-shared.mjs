import { JURISDICTIONS } from '../workers/pp-api/src/config/jurisdictions.js';

export const US_EXPANSION_BATCHES = {
  batch1: [
    'la_city',
    'la_county',
    'alameda',
    'belmont',
    'beverly_hills',
    'culver_city',
    'contra_costa_county',
    'lodi',
    'ontario',
    'riverside',
    'sacramento',
    'sacramento_county',
    'san_bernardino_county',
    'san_diego_county',
    'san_jose',
    'san_francisco',
    'santa_clara_county',
    'long_beach',
    'santa_monica',
    'solana_beach',
  ],
  batch2: [
    'boston',
    'el_paso',
    'nashville',
    'detroit',
    'oklahoma_city',
    'portland',
    'las_vegas',
    'memphis',
    'louisville',
    'baltimore',
    'milwaukee',
    'albuquerque',
    'tucson',
    'fresno',
    'sacramento',
    'mesa',
    'atlanta',
    'kansas_city',
    'colorado_springs',
    'omaha',
  ],
  batch3: [
    'oakland',
    'minneapolis',
    'tulsa',
    'bakersfield',
    'wichita',
    'arlington',
    'aurora',
    'tampa',
    'new_orleans',
    'cleveland',
    'honolulu',
    'anaheim',
    'henderson',
    'riverside',
    'stockton',
    'lexington',
    'virginia_beach',
    'corpus_christi',
    'irvine',
    'cincinnati',
  ],
};

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
    return { ok: false, status: 0, detail: 'missing_url', blocked: false };
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

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type') || '',
      detail: response.ok ? 'ok' : `http_${response.status}`,
      blocked: false,
    };
  } catch (error) {
    const detail = error && error.message ? String(error.message) : 'fetch_failed';
    const normalized = detail.toLowerCase();
    const blocked = normalized.includes('fetch failed') || normalized.includes('network') || normalized.includes('eai_again');
    return {
      ok: false,
      status: 0,
      detail,
      blocked,
    };
  }
}

function getTier(entry) {
  return entry.provider ? 'api_backed' : 'portal_only';
}

function validateCatalog(batchName, batchIds) {
  const ids = JURISDICTIONS.map((entry) => entry.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingIds = batchIds.filter((id) => !ids.includes(id));
  const batch = batchIds.map((id) => JURISDICTIONS.find((entry) => entry.id === id)).filter(Boolean);
  const issues = [];

  if (duplicateIds.length) {
    issues.push(`duplicate_catalog_ids: ${[...new Set(duplicateIds)].join(', ')}`);
  }

  if (missingIds.length) {
    issues.push(`missing_batch_ids (${batchName}): ${missingIds.join(', ')}`);
  }

  for (const entry of batch) {
    if (!entry.provider && !entry.portalUrl) {
      issues.push(`missing_portal_url: ${entry.id}`);
    }

    if (entry.provider && !buildApiProbe(entry)) {
      issues.push(`unsupported_provider_probe: ${entry.id}`);
    }
  }

  return { batch, issues };
}

async function verifyEntry(entry) {
  const apiUrl = buildApiProbe(entry);
  const portal = entry.portalUrl ? await probeUrl(entry.portalUrl) : null;
  const api = apiUrl ? await probeUrl(apiUrl, { method: 'GET', headers: { Accept: 'application/json' } }) : null;
  const warnings = [];

  if (portal && !portal.ok) {
    warnings.push(`portal_probe_${portal.blocked ? 'blocked' : 'failed'}:${portal.detail}`);
  }

  if (apiUrl && api && !api.ok) {
    warnings.push(`api_probe_${api.blocked ? 'blocked' : 'failed'}:${api.detail}`);
  }

  return {
    id: entry.id,
    name: entry.name,
    enabled: entry.enabled !== false,
    tier: getTier(entry),
    platform: entry.platform || null,
    portalUrl: entry.portalUrl || null,
    portalStatus: portal ? portal.status : null,
    portalDetail: portal ? portal.detail : null,
    apiUrl,
    apiStatus: api ? api.status : null,
    apiDetail: api ? api.detail : null,
    warnings,
  };
}

function printGroup(label, items, formatter) {
  console.log(`\n## ${label}`);
  if (!items.length) {
    console.log('- none');
    return;
  }

  for (const item of items) {
    console.log(`- ${formatter(item)}`);
  }
}

export async function runBatchVerification(batchName, batchIds) {
  const { batch, issues } = validateCatalog(batchName, batchIds);

  if (issues.length) {
    printGroup('schema_issues', issues, (item) => item);
    return { ok: false, schemaIssues: issues, results: [] };
  }

  const results = [];
  for (const entry of batch) {
    results.push(await verifyEntry(entry));
  }

  const apiBacked = results.filter((item) => item.tier === 'api_backed');
  const portalOnly = results.filter((item) => item.tier === 'portal_only');
  const warningItems = results.filter((item) => item.warnings.length);

  printGroup('api_backed', apiBacked, (item) => {
    const bits = [`${item.name} (${item.id})`];
    if (item.apiUrl) bits.push(`api_url=${item.apiUrl}`);
    if (item.warnings.length) bits.push(`warnings=${item.warnings.join(',')}`);
    return bits.join(' | ');
  });

  printGroup('portal_only', portalOnly, (item) => {
    const bits = [`${item.name} (${item.id})`];
    if (item.portalUrl) bits.push(`portal_url=${item.portalUrl}`);
    if (item.warnings.length) bits.push(`warnings=${item.warnings.join(',')}`);
    return bits.join(' | ');
  });

  printGroup('probe_warnings', warningItems, (item) => `${item.name} (${item.id}) | ${item.warnings.join(' | ')}`);

  console.log('\n## summary');
  console.log(`- batch=${batchName}`);
  console.log(`- total=${results.length}`);
  console.log(`- api_backed=${apiBacked.length}`);
  console.log(`- portal_only=${portalOnly.length}`);
  console.log(`- probe_warnings=${warningItems.length}`);
  console.log(`- schema_issues=0`);

  return { ok: true, schemaIssues: [], results };
}
