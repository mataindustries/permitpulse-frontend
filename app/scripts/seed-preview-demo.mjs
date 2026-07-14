import { readFile, stat } from "node:fs/promises";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
} from "pdf-lib";

const configuredUrl = process.env.PERMITPULSE_PREVIEW_ORIGIN;
const email = process.env.PERMITPULSE_DEMO_ADMIN_EMAIL;
const password = process.env.PERMITPULSE_DEMO_ADMIN_PASSWORD;
const tokenFile = process.env.PERMITPULSE_PREVIEW_SEED_TOKEN_FILE;

let baseUrl;
try {
  const parsed = new URL(configuredUrl ?? "");
  const originOnly = parsed.username === "" && parsed.password === "" &&
    parsed.pathname === "/" && parsed.search === "" && parsed.hash === "";
  if (!originOnly || parsed.protocol !== "https:") throw new Error();
  baseUrl = parsed.origin;
} catch {
  console.error("PERMITPULSE_PREVIEW_ORIGIN must be an explicit HTTPS origin with no path, query, or credentials.");
  process.exit(1);
}

if (!email || !password) {
  console.error("Set PERMITPULSE_DEMO_ADMIN_EMAIL and PERMITPULSE_DEMO_ADMIN_PASSWORD for the existing preview administrator.");
  process.exit(1);
}
if (!tokenFile) {
  console.error("Set PERMITPULSE_PREVIEW_SEED_TOKEN_FILE to the permission-restricted temporary token file.");
  process.exit(1);
}

let token;
try {
  const metadata = await stat(tokenFile);
  if ((metadata.mode & 0o077) !== 0) throw new Error();
  token = (await readFile(tokenFile,"utf8")).trim();
} catch {
  console.error("The temporary preview seed token file must be readable and inaccessible to group or other users.");
  process.exit(1);
}
if (new TextEncoder().encode(token).byteLength < 32) {
  console.error("The temporary preview seed token must contain at least 32 high-entropy bytes.");
  process.exit(1);
}

async function readPayload(response) {
  return response.json().catch(() => null);
}

let signIn;
try {
  signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method:"POST",
    headers:{"content-type":"application/json",origin:baseUrl},
    body:JSON.stringify({email,password}),
  });
} catch {
  console.error(`Could not connect to the preview origin ${baseUrl}.`);
  process.exit(1);
}
if (!signIn.ok) {
  console.error(`Preview administrator authentication failed (${signIn.status}).`);
  process.exit(1);
}
const cookie = signIn.headers.get("set-cookie")?.split(";",1)[0];
if (!cookie) {
  console.error("Preview sign-in did not return a session cookie.");
  process.exit(1);
}

const seeded = await fetch(`${baseUrl}/api/internal/seed-arroyo-vista`, {
  method:"POST",
  headers:{
    authorization:`Bearer ${token}`,
    "content-type":"application/json",
    cookie,
    origin:baseUrl,
  },
  body:JSON.stringify({confirmation:"seed-canonical-arroyo-vista-v1"}),
});
const payload = await readPayload(seeded);
if (!seeded.ok) {
  if (seeded.status === 404) console.error("Preview demo seed is disabled. Confirm the temporary preview seed deployment is active.");
  else if (seeded.status === 401) console.error("Preview demo seed authorization was not accepted.");
  else if (seeded.status === 403) console.error("The authenticated preview account is not an administrator.");
  else console.error(`Preview demo seed failed (${seeded.status}): ${JSON.stringify(payload)}`);
  process.exit(1);
}

const caseId = payload?.data?.case_id;
if (typeof caseId !== "string") {
  console.error("Preview demo seed returned an invalid case identifier.");
  process.exit(1);
}

const authenticatedHeaders = { cookie };
const packetResponse = await fetch(`${baseUrl}/api/v1/cases/${caseId}/packet`, {
  headers: authenticatedHeaders,
});
const packetPayload = await readPayload(packetResponse);
const packet = packetPayload?.data?.packet;
const quality = packetPayload?.data?.quality;
if (
  !packetResponse.ok || packet?.presentation_version !== 3 ||
  packetPayload?.data?.persisted_snapshot !== true ||
  !Array.isArray(quality?.blockers) || quality.blockers.length !== 0 ||
  quality?.stale_snapshot !== false || packet.evidence_summaries?.length !== 9 ||
  packet.timeline_summaries?.length !== 8 || packet.findings?.items?.length !== 4 ||
  packet.open_questions?.items?.length !== 5 ||
  packet.recommended_next_actions?.items?.length !== 4 ||
  packet.agency_dependencies?.length !== 3 || !packet.action_kit
) {
  console.error("Preview packet verification failed after the seed operation.");
  process.exit(1);
}

const pdfResponse = await fetch(`${baseUrl}/api/v1/cases/${caseId}/packet.pdf`, {
  headers: authenticatedHeaders,
});
if (!pdfResponse.ok || pdfResponse.headers.get("content-type") !== "application/pdf") {
  console.error("Preview PDF verification failed after the seed operation.");
  process.exit(1);
}
const document = await PDFDocument.load(await pdfResponse.arrayBuffer());
const operators = document.getPages().map((page) => {
  const contents = page.node.Contents();
  const resolved = page.node.context.lookup(contents);
  const entries = resolved instanceof PDFArray ? resolved.asArray() : [contents];
  return entries.map((entry) => new TextDecoder().decode(
    decodePDFRawStream(page.node.context.lookup(entry)).decode(),
  )).join("\n");
}).join("\n");
const requiredSections = [
  "Findings",
  "Agency Dependency Map",
  "Open Questions",
  "Recommended Next Actions",
  "Agency Follow-Up Kit",
  "Timeline",
  "Supporting Evidence",
];
const missingPdfSections = requiredSections.filter((value) =>
  !operators.includes(Buffer.from(value,"latin1").toString("hex").toUpperCase())
);
if (document.getPageCount() <= 3 || missingPdfSections.length > 0) {
  console.error("Preview PDF is missing one or more populated canonical sections.");
  process.exit(1);
}

console.log(JSON.stringify({
  ...payload.data,
  verification:{
    action_kit_ready:true,
    agency_dependency_count:3,
    evidence_count:9,
    packet_quality_blockers:0,
    pdf_page_count:document.getPageCount(),
    pdf_sections:requiredSections,
    persisted_snapshot:true,
    presentation_version:3,
    renderer_version:payload.data.renderer_version,
    timeline_count:8,
  },
},null,2));
