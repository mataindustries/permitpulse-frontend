import { JURISDICTIONS } from '../../workers/pp-api/src/config/jurisdictions.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const ROLE_LABELS = new Set(['homeowner', 'contractor', 'investor', 'expeditor']);
const OPENAI_URL = 'https://api.openai.com/v1/responses';

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const input = normalizeInput(payload);

  if (!input.address || !input.city || !input.project_description) {
    return json(
      {
        ok: false,
        error: 'missing_required_fields',
        required: ['address', 'city', 'project_description'],
      },
      400,
    );
  }

  const jurisdictionMatch = findJurisdictionMatch(input);
  const fallbackSnapshot = buildSnapshotFromHeuristics(input, jurisdictionMatch);
  const snapshot = await maybeEnhanceSnapshotWithLlm(fallbackSnapshot, input, jurisdictionMatch, env);

  return json({
    ok: true,
    input,
    snapshot,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...CORS_HEADERS,
    },
  });
}

function normalizeInput(payload) {
  const address = cleanString(payload?.address);
  const city = cleanString(payload?.city);
  const projectDescription = cleanString(payload?.project_description);
  const apn = cleanString(payload?.apn);
  const voiceTranscript = cleanString(payload?.voice_transcript);
  const role = cleanRole(payload?.role);

  return {
    address,
    city,
    project_description: projectDescription,
    apn,
    role,
    voice_transcript: voiceTranscript,
  };
}

function cleanString(value) {
  return String(value || '').trim();
}

function cleanRole(value) {
  const normalized = cleanString(value).toLowerCase();
  return ROLE_LABELS.has(normalized) ? normalized : '';
}


function getStateName(stateCode) {
  return STATE_NAMES[stateCode] || stateCode || '';
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+\(.+?\)\s*$/g, '')
    .replace(/\+/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCity(value) {
  return slugify(value)
    .replace(/-city$/, '')
    .replace(/-county$/, '')
    .replace(/^city-of-/, '')
    .replace(/^county-of-/, '');
}

function findJurisdictionMatch(input) {
  const requestedCity = normalizeCity(input.city);
  const exactMatches = JURISDICTIONS.filter((entry) => entry.enabled !== false && normalizeCity(entry.name) === requestedCity);

  if (exactMatches.length === 1) {
    return buildJurisdictionPayload(exactMatches[0], 'exact_city', 92, exactMatches.length);
  }

  if (exactMatches.length > 1) {
    return buildJurisdictionPayload(exactMatches[0], 'ambiguous_city', 66, exactMatches.length);
  }

  const partialMatches = JURISDICTIONS.filter((entry) => {
    if (entry.enabled === false) return false;
    const name = normalizeCity(entry.name);
    return name.includes(requestedCity) || requestedCity.includes(name);
  });

  if (partialMatches.length) {
    return buildJurisdictionPayload(partialMatches[0], 'partial_city', 54, partialMatches.length);
  }

  return {
    matched: false,
    confidence: 28,
    match_type: 'unmatched',
    candidates: 0,
    id: null,
    name: input.city,
    state: null,
    state_name: null,
    state_slug: null,
    city_slug: null,
    permits_path: null,
    platform: null,
    portal_url: null,
    portal_notes: null,
    provider_available: false,
  };
}

function buildJurisdictionPayload(entry, matchType, confidence, candidates) {
  const stateCode = entry.state || null;
  const stateName = getStateName(stateCode);
  const citySlug = slugify(entry.name);
  const stateSlug = slugify(stateName);

  return {
    matched: true,
    confidence,
    match_type: matchType,
    candidates,
    id: entry.id,
    name: entry.name,
    state: stateCode,
    state_name: stateName,
    state_slug: stateSlug,
    city_slug: citySlug,
    permits_path: stateSlug ? `/permits/${stateSlug}/${citySlug}/` : null,
    platform: entry.platform || null,
    portal_url: entry.portalUrl || null,
    portal_notes: entry.portalNotes || null,
    provider_available: Boolean(entry.provider),
  };
}

function buildSnapshotFromHeuristics(input, jurisdictionMatch) {
  const permitPath = inferPermitPath(input.project_description);
  const missingInfo = inferMissingInfo(input, permitPath);
  const riskNotes = inferRiskNotes(input, jurisdictionMatch, permitPath, missingInfo);
  const projectSummary = buildProjectSummary(input, jurisdictionMatch, permitPath);
  const nextStep = buildNextStep(jurisdictionMatch, permitPath, missingInfo);
  const confidence = Math.max(
    34,
    Math.min(
      95,
      Math.round((jurisdictionMatch.confidence * 0.7) + (permitPath.length ? 18 : 8) + (input.apn ? 4 : 0)),
    ),
  );

  return {
    project_summary: projectSummary,
    likely_jurisdiction: {
      id: jurisdictionMatch.id,
      name: jurisdictionMatch.name,
      state: jurisdictionMatch.state,
      state_name: jurisdictionMatch.state_name,
      state_slug: jurisdictionMatch.state_slug,
      city_slug: jurisdictionMatch.city_slug,
      permits_path: jurisdictionMatch.permits_path,
      match_type: jurisdictionMatch.match_type,
      platform: jurisdictionMatch.platform,
      provider_available: jurisdictionMatch.provider_available,
    },
    portal_url: jurisdictionMatch.portal_url,
    likely_permit_path: permitPath,
    missing_info: missingInfo,
    risk_notes: riskNotes,
    next_step: nextStep,
    confidence,
    disclaimer:
      'Instant Snapshot is an informational intake brief based on your inputs and PermitPulse catalog data. It is not official jurisdiction guidance or permit approval advice.',
  };
}

function inferPermitPath(projectDescription) {
  const text = projectDescription.toLowerCase();
  const matches = [];

  pushIf(matches, /(adu|garage conversion|accessory dwelling|addition|new room)/.test(text), 'Building permit review for added floor area or new habitable space');
  pushIf(matches, /(kitchen|bath|remodel|renovation|tenant improvement|ti\b|interior)/.test(text), 'Building permit intake for interior remodel or tenant improvement scope');
  pushIf(matches, /(roof|reroof|re-roof)/.test(text), 'Roofing permit lane with contractor, material, and scope confirmation');
  pushIf(matches, /(solar|photovoltaic|battery|ev charger)/.test(text), 'Electrical or solar review path with utility-facing scope checks');
  pushIf(matches, /(panel|rewire|electrical|service upgrade|subpanel)/.test(text), 'Electrical permit path with service and load details');
  pushIf(matches, /(hvac|mechanical|mini split|furnace|air conditioning|heat pump)/.test(text), 'Mechanical permit path for equipment replacement or added systems');
  pushIf(matches, /(plumbing|sewer|water heater|repipe)/.test(text), 'Plumbing permit path for line, fixture, or equipment work');
  pushIf(matches, /(demo|demolition|tear down)/.test(text), 'Demolition or selective demo review before rebuild sequencing');
  pushIf(matches, /(foundation|retaining wall|structural|beam|framing)/.test(text), 'Structural review likely required with plan-set level detail');

  if (!matches.length) {
    matches.push('General building permit intake with scope clarification before portal submission');
  }

  return matches.slice(0, 4);
}

function inferMissingInfo(input, permitPath) {
  const missing = [];

  if (!input.apn) {
    missing.push('APN or parcel number to confirm property identity quickly');
  }
  if (!/\d/.test(input.address)) {
    missing.push('Street number or fuller address format for cleaner jurisdiction lookup');
  }
  if (!/(sq|square|sf|unit|suite|adu|roof|panel|amp|ton|kw|bath|kitchen|addition|remodel)/i.test(input.project_description)) {
    missing.push('A tighter scope description such as size, trade, equipment, or affected area');
  }
  if (!input.role) {
    missing.push('Your role so the brief can frame the next step more precisely');
  }
  if (permitPath.some((item) => /structural|added floor area|plan-set/i.test(item))) {
    missing.push('Whether stamped plans, structural changes, or added square footage are involved');
  }

  return dedupe(missing).slice(0, 5);
}

function inferRiskNotes(input, jurisdictionMatch, permitPath, missingInfo) {
  const notes = [];

  if (!jurisdictionMatch.matched) {
    notes.push('Jurisdiction match is partial, so the portal link and next step should be treated as directional rather than final.');
  } else if (jurisdictionMatch.match_type !== 'exact_city') {
    notes.push('The city name matched imperfectly, which can happen when county-served pockets and city names overlap.');
  }

  if (permitPath.some((item) => /structural|added floor area|plan-set/i.test(item))) {
    notes.push('Plan-check timing and correction risk increase once structural scope or added area enters the project.');
  }
  if (permitPath.some((item) => /solar|Electrical or solar/i.test(item))) {
    notes.push('Utility coordination, service capacity, or equipment specs may become gating items.');
  }
  if (missingInfo.length >= 3) {
    notes.push('Several key intake details are still missing, so the first portal pass may be slower than it needs to be.');
  }
  if (input.voice_transcript && input.voice_transcript.length > 280) {
    notes.push('The voice transcript adds context, but it likely still needs a cleaner written scope before anyone should rely on it.');
  }

  if (!notes.length) {
    notes.push('The project reads like a plausible permit intake candidate, but the official portal still controls final routing and scope requirements.');
  }

  return notes.slice(0, 4);
}

function buildProjectSummary(input, jurisdictionMatch, permitPath) {
  const roleLabel = input.role ? `${capitalize(input.role)} intake` : 'Permit intake';
  const jurisdictionLabel = jurisdictionMatch.matched
    ? `${jurisdictionMatch.name}${jurisdictionMatch.state_name ? `, ${jurisdictionMatch.state_name}` : jurisdictionMatch.state ? `, ${jurisdictionMatch.state}` : ''}`
    : input.city;
  const permitLead = permitPath[0] || 'general building permit intake';

  return `${roleLabel} for ${input.address}, ${input.city}. Based on the current description, this looks closest to ${permitLead.toLowerCase()} under ${jurisdictionLabel}. The brief is strongest as a fast pre-submission read, not a filing decision.`;
}

function buildNextStep(jurisdictionMatch, permitPath, missingInfo) {
  if (jurisdictionMatch.portal_url) {
    if (missingInfo.length > 2) {
      return `Open the official ${jurisdictionMatch.platform || 'permit'} portal, but tighten the missing intake details first so the first pass is cleaner.`;
    }
    return `Open the official ${jurisdictionMatch.platform || 'permit'} portal and pressure-test the scope against ${permitPath[0].toLowerCase()}.`;
  }

  return 'Use this brief to confirm the exact jurisdiction first, then escalate into PermitPulse help before anyone assumes the filing lane.';
}

function pushIf(list, condition, value) {
  if (condition && !list.includes(value)) {
    list.push(value);
  }
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

async function maybeEnhanceSnapshotWithLlm(snapshot, input, jurisdictionMatch, env) {
  if (!env?.OPENAI_API_KEY) {
    return snapshot;
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_SNAPSHOT_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'Return concise JSON only. Keep all claims grounded in the provided intake and jurisdiction metadata. Do not claim permit approval, guaranteed routing, or official filing certainty.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  input,
                  jurisdiction_match: jurisdictionMatch,
                  fallback_snapshot: snapshot,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'instant_snapshot',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: [
                'project_summary',
                'likely_jurisdiction',
                'portal_url',
                'likely_permit_path',
                'missing_info',
                'risk_notes',
                'next_step',
                'confidence',
                'disclaimer',
              ],
              properties: {
                project_summary: { type: 'string' },
                likely_jurisdiction: { type: 'object', additionalProperties: true },
                portal_url: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                likely_permit_path: { type: 'array', items: { type: 'string' } },
                missing_info: { type: 'array', items: { type: 'string' } },
                risk_notes: { type: 'array', items: { type: 'string' } },
                next_step: { type: 'string' },
                confidence: { type: 'number' },
                disclaimer: { type: 'string' },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return snapshot;
    }

    const data = await response.json();
    const text = data?.output?.[0]?.content?.[0]?.text;
    if (!text) {
      return snapshot;
    }

    const parsed = JSON.parse(text);
    return {
      ...snapshot,
      ...parsed,
      likely_jurisdiction: {
        ...snapshot.likely_jurisdiction,
        ...(parsed?.likely_jurisdiction || {}),
      },
      portal_url: parsed?.portal_url || snapshot.portal_url,
      likely_permit_path: Array.isArray(parsed?.likely_permit_path)
        ? parsed.likely_permit_path
        : snapshot.likely_permit_path,
      missing_info: Array.isArray(parsed?.missing_info) ? parsed.missing_info : snapshot.missing_info,
      risk_notes: Array.isArray(parsed?.risk_notes) ? parsed.risk_notes : snapshot.risk_notes,
      confidence: Number.isFinite(parsed?.confidence) ? parsed.confidence : snapshot.confidence,
    };
  } catch {
    return snapshot;
  }
}
