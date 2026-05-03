import { JSON_HEADERS } from '../config/permits.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 20000;

const REPORT_JSON_SCHEMA = {
	name: 'mission_control_report',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: [
			'project_summary',
			'jurisdiction',
			'confidence_score',
			'project_pulse',
			'timeline',
			'red_flags',
			'next_actions',
			'outreach_angle',
			'source_links',
		],
		properties: {
			project_summary: { type: 'string' },
			jurisdiction: { type: 'string' },
			confidence_score: { type: 'integer', minimum: 0, maximum: 100 },
			project_pulse: { type: 'string' },
			timeline: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['date', 'event', 'detail', 'status'],
					properties: {
						date: { type: 'string' },
						event: { type: 'string' },
						detail: { type: 'string' },
						status: { type: 'string', enum: ['done', 'warn', 'active'] },
					},
				},
			},
			red_flags: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['title', 'detail', 'severity'],
					properties: {
						title: { type: 'string' },
						detail: { type: 'string' },
						severity: { type: 'string', enum: ['high', 'medium', 'low'] },
					},
				},
			},
			next_actions: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['step', 'title', 'detail'],
					properties: {
						step: { type: 'string' },
						title: { type: 'string' },
						detail: { type: 'string' },
					},
				},
			},
			outreach_angle: { type: 'string' },
			source_links: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['label', 'url'],
					properties: {
						label: { type: 'string' },
						url: { type: 'string' },
					},
				},
			},
		},
	},
};

function jsonResponse(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: JSON_HEADERS,
	});
}

function normalizeText(value, maxLength = 500) {
	return String(value || '').trim().slice(0, maxLength);
}

function normalizeRecord(record) {
	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		return null;
	}

	const candidate = {};
	for (const [key, value] of Object.entries(record)) {
		if (value == null) continue;
		if (typeof value === 'object') {
			candidate[key] = JSON.stringify(value).slice(0, 1000);
			continue;
		}
		candidate[key] = String(value).slice(0, 1000);
	}
	return candidate;
}

function normalizeRecordArray(value, limit = 12) {
	if (!Array.isArray(value)) return [];
	return value.map(normalizeRecord).filter(Boolean).slice(0, limit);
}

function validateInput(body) {
	const input = {
		address: normalizeText(body?.address, 240),
		city: normalizeText(body?.city, 120),
		apn: normalizeText(body?.apn, 80),
		permit_number: normalizeText(body?.permit_number, 120),
		openai_model: normalizeText(body?.openai_model, 120),
		source_records: normalizeRecordArray(body?.source_records),
		mock_records: normalizeRecordArray(body?.mock_records),
	};

	const hasIdentity = Boolean(
		input.address || input.city || input.apn || input.permit_number || input.source_records.length || input.mock_records.length
	);

	if (!hasIdentity) {
		return {
			ok: false,
			error: 'missing_input',
			detail: 'Provide at least one of: address, city, APN, permit number, source_records, or mock_records.',
		};
	}

	return { ok: true, input };
}

function buildMockRecords(input) {
	const city = input.city || 'Los Angeles';
	const address = input.address || '742 S Mission Rd';
	const permitNumber = input.permit_number || 'MC-2026-01884';
	const apn = input.apn || '5182-014-031';

	return [
		{
			record_type: 'permit_header',
			address,
			city,
			apn,
			permit_number: permitNumber,
			status: 'Revision queue active',
			description: 'Adaptive reuse / tenant improvement / life-safety upgrades',
			last_activity_at: '2026-04-03',
		},
		{
			record_type: 'timeline_event',
			date: '2026-03-28',
			event: 'Applicant resubmittal posted',
			detail: 'Updated architectural and code sheets uploaded after review comments.',
			status: 'warn',
		},
		{
			record_type: 'timeline_event',
			date: '2026-01-14',
			event: 'Fire review comments issued',
			detail: 'Alarm sequencing, exiting, and occupancy notes created a hold condition.',
			status: 'warn',
		},
	];
}

function buildSourceLinks(records, fallbackMode) {
	const urls = [];
	for (const record of records) {
		if (record?.source_url) {
			urls.push({
				label: normalizeText(record.source_label || record.record_type || 'Permit source', 80) || 'Permit source',
				url: normalizeText(record.source_url, 500),
			});
		}
	}

	if (!urls.length && fallbackMode) {
		urls.push({
			label: 'Mock mission-control source',
			url: 'https://getpermitpulse.com/mission-control/',
		});
	}

	return urls.slice(0, 6);
}

function buildFallbackDossier(input, records, mode, reason, sourceLinks) {
	const city = input.city || 'Los Angeles';
	const jurisdiction = city ? `${city} Building + Fire` : 'Jurisdiction under review';
	const addressLine = input.address || 'Address pending';
	const permitNumber = input.permit_number || 'Permit number not supplied';
	const apn = input.apn || 'APN not supplied';

	return {
		ok: true,
		mode,
		fallback_reason: reason,
		project_summary:
			`Mock permit review for ${addressLine}. The visible permit context suggests an active but non-linear project path. ` +
			`Permit ${permitNumber} and parcel ${apn} should be treated as operator inputs until live connectors are wired.`,
		jurisdiction,
		confidence_score: 72,
		project_pulse: records.length ? 'Mock pulse: activity detected, review loop likely' : 'Mock pulse: limited record visibility',
		timeline: [
			{
				date: '2026-04-03',
				event: 'Mock permit review generated',
				detail: 'Fallback mode synthesized a tactical timeline because live permit records were unavailable.',
				status: 'active',
			},
			{
				date: '2026-03-28',
				event: 'Recent revision activity assumed',
				detail: 'Use this as a UI-safe placeholder until live portal connectors return normalized events.',
				status: 'warn',
			},
		],
		red_flags: [
			{
				title: 'Live permit context incomplete',
				detail: 'The permit review is operating on mock or partial records, so issue timing and blockers should be validated before client use.',
				severity: 'high',
			},
			{
				title: 'Jurisdiction workflow may be multi-threaded',
				detail: 'Future connectors should merge linked permits, inspections, and correction cycles into one operator view.',
				severity: 'medium',
			},
		],
		next_actions: [
			{
				step: 'Action 01',
				title: 'Confirm source permit family',
				detail: 'Verify the exact permit number, address normalization, and linked records before escalating any recommendations.',
			},
			{
				step: 'Action 02',
				title: 'Wire live permit connectors',
				detail: 'Future live connector data should plug in ahead of permit review generation so the AI sees normalized portal history instead of mock records.',
			},
		],
		outreach_angle:
			'Use PermitPulse as the fast diagnosis layer: clarify whether the file is truly moving or only showing procedural activity before the client spends time on generic follow-up.',
		source_links: sourceLinks,
	};
}

function buildPromptPayload(input, records) {
	return {
		property_context: {
			address: input.address || null,
			city: input.city || null,
			apn: input.apn || null,
			permit_number: input.permit_number || null,
		},
		records,
	};
}

function buildOpenAIRequest(input, records) {
	const promptPayload = buildPromptPayload(input, records);
	return {
		model: input.openai_model || DEFAULT_OPENAI_MODEL,
		input: [
			{
				role: 'system',
				content: [
					{
						type: 'input_text',
						text:
							'You are PermitPulse Mission Control. Build a concise permit review from the provided property context and permit records. ' +
							'Stay grounded in supplied facts. If the records are thin, say so indirectly through lower confidence and cautious wording. ' +
							'Timeline items must be reverse chronological. Red flags and next actions must be specific and actionable.',
					},
				],
			},
			{
				role: 'user',
				content: [
					{
						type: 'input_text',
						text: JSON.stringify(promptPayload),
					},
				],
			},
		],
		text: {
			format: {
				type: 'json_schema',
				name: REPORT_JSON_SCHEMA.name,
				strict: true,
				schema: REPORT_JSON_SCHEMA.schema,
			},
		},
	};
}

async function callOpenAIForReport(env, input, records) {
	const apiKey = normalizeText(env.OPENAI_API_KEY, 500);
	if (!apiKey) {
		throw new Error('missing_openai_api_key');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort('openai_timeout'), OPENAI_TIMEOUT_MS);

	try {
		const response = await fetch(OPENAI_API_URL, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(buildOpenAIRequest(input, records)),
			signal: controller.signal,
		});

		const text = await response.text();
		if (!response.ok) {
			throw new Error(`openai_${response.status}:${text.slice(0, 600)}`);
		}

		const payload = JSON.parse(text);
		const parsed = extractStructuredOutput(payload);
		if (!parsed) {
			throw new Error('openai_invalid_json_schema_output');
		}
		return parsed;
	} finally {
		clearTimeout(timeoutId);
	}
}

function extractStructuredOutput(payload) {
	if (payload && typeof payload.output_parsed === 'object' && payload.output_parsed) {
		return payload.output_parsed;
	}

	if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
		try {
			return JSON.parse(payload.output_text);
		} catch (_) {}
	}

	const outputItems = Array.isArray(payload?.output) ? payload.output : [];
	for (const item of outputItems) {
		const contents = Array.isArray(item?.content) ? item.content : [];
		for (const content of contents) {
			if (typeof content?.text === 'string' && content.text.trim()) {
				try {
					return JSON.parse(content.text);
				} catch (_) {}
			}
		}
	}

	return null;
}

function finalizeDossier(aiDossier, sourceLinks) {
	return {
		project_summary: normalizeText(aiDossier.project_summary, 3000),
		jurisdiction: normalizeText(aiDossier.jurisdiction, 240),
		confidence_score: Math.max(0, Math.min(100, Number(aiDossier.confidence_score) || 0)),
		project_pulse: normalizeText(aiDossier.project_pulse, 240),
		timeline: Array.isArray(aiDossier.timeline) ? aiDossier.timeline.slice(0, 10) : [],
		red_flags: Array.isArray(aiDossier.red_flags) ? aiDossier.red_flags.slice(0, 8) : [],
		next_actions: Array.isArray(aiDossier.next_actions) ? aiDossier.next_actions.slice(0, 8) : [],
		outreach_angle: normalizeText(aiDossier.outreach_angle, 2000),
		source_links: Array.isArray(aiDossier.source_links) && aiDossier.source_links.length
			? aiDossier.source_links.slice(0, 8)
			: sourceLinks,
	};
}

export async function handleMissionControlReport({ request, env }) {
	if (request.method !== 'POST') {
		return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ ok: false, error: 'bad_json', detail: 'Request body must be valid JSON.' }, 400);
	}

	const validation = validateInput(body);
	if (!validation.ok) {
		return jsonResponse(validation, 400);
	}

	const input = validation.input;

	// Future live connector plug-in point:
	// normalize portal/API records here before calling OpenAI so every upstream
	// source lands in the same record shape for permit review generation.
	const sourceRecords = input.source_records;
	const mockRecords = input.mock_records;
	const hasLiveRecords = sourceRecords.length > 0;
	const records = hasLiveRecords ? sourceRecords : mockRecords.length ? mockRecords : buildMockRecords(input);
	const sourceLinks = buildSourceLinks(records, !hasLiveRecords);

	if (!records.length) {
		return jsonResponse(
			buildFallbackDossier(input, records, 'mock_fallback', 'no_records_available', sourceLinks),
			200
		);
	}

	try {
		const aiDossier = await callOpenAIForReport(env, input, records);
		return jsonResponse({
			ok: true,
			mode: hasLiveRecords ? 'live_records' : 'mock_records',
			...finalizeDossier(aiDossier, sourceLinks),
		});
	} catch (error) {
		const detail = String(error?.message || error);
		return jsonResponse(
			buildFallbackDossier(
				input,
				records,
				hasLiveRecords ? 'live_fallback' : 'mock_fallback',
				detail,
				sourceLinks
			),
			200
		);
	}
}
