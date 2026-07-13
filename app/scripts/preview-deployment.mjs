import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceConfigPath = resolve("wrangler.jsonc");
const resolvedConfigPath = resolve(".wrangler.preview.jsonc");
const initialSecretsPath = "/tmp/permitpulse-preview-secrets.env";
const expectedMigrationNames = [
  "0001_create_cases.sql",
  "0002_auth_foundation.sql",
  "0003_auth_roles_admin.sql",
  "0004_case_participants.sql",
  "0005_case_lifecycle_audit.sql",
  "0006_evidence_timeline.sql",
  "0007_delivery_lifecycle.sql",
  "0008_reviewer_editorial_workspace.sql",
  "0009_decision_brief_action_kit.sql",
  "0010_evidence_intake.sql",
];
const previewDatabaseName = "permitpulse-case-workspace-preview";
const previewBucketName = "permitpulse-evidence-files-preview";
const previewWorkerName = "permitpulse-case-workspace-preview";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) {
  throw new Error(`Preview deployment preflight failed: ${message}`);
}

function requireExactBoolean(value, name, fallback = "false") {
  const resolved = value ?? fallback;
  if (resolved !== "true" && resolved !== "false") {
    fail(`${name} must be exactly true or false.`);
  }
  return resolved;
}

function validateHttpsOrigin(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${name} must be an explicit HTTPS origin.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    fail(`${name} must be an explicit HTTPS origin.`);
  }
  return parsed.origin;
}

async function readConfig(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(`${path} must remain valid JSON-compatible JSONC.`);
  }
  return parsed;
}

function requiredBinding(collection, binding, label) {
  const match = collection?.find((item) => item.binding === binding);
  if (!match) fail(`${label} binding ${binding} is missing.`);
  return match;
}

async function validateConfig(config, { resolved }) {
  if (config.compatibility_flags?.includes("nodejs_compat") !== true) {
    fail("nodejs_compat must remain enabled.");
  }
  if (config.observability?.logs?.enabled !== true) {
    fail("Workers Logs must remain enabled.");
  }
  if (config.vars?.APP_ENV !== "production" || config.vars?.AUTH_ENABLED !== "false") {
    fail("the top-level production configuration must remain authentication-disabled.");
  }
  if (config.vars?.AUTH_ALLOW_SIGNUP !== "false" || config.vars?.ENABLE_DEV_CASE_API !== "false") {
    fail("production signup and development APIs must remain disabled.");
  }

  const preview = config.env?.preview;
  if (!preview || preview.name !== previewWorkerName) {
    fail("the dedicated preview Worker environment is missing.");
  }
  const vars = preview.vars ?? {};
  const requiredValues = {
    AI_REVIEW_EXTERNAL_CALLS_ENABLED: "false",
    AI_REVIEW_LIVE_ENABLED: "false",
    AI_REVIEW_LOCAL_TEST_ENABLED: "false",
    AI_REVIEW_PROVIDER: "deterministic-baseline",
    APP_ENV: "preview",
    AUTH_ALLOW_SIGNUP: "false",
    AUTH_ENABLED: "true",
    ENABLE_DEV_CASE_API: "false",
  };
  for (const [name, expected] of Object.entries(requiredValues)) {
    if (vars[name] !== expected) fail(`${name} must remain ${expected} in preview.`);
  }
  validateHttpsOrigin(vars.BETTER_AUTH_URL, "preview BETTER_AUTH_URL");

  const requiredSecrets = preview.secrets?.required ?? [];
  if (!requiredSecrets.includes("BETTER_AUTH_SECRET")) {
    fail("preview must declare BETTER_AUTH_SECRET as required.");
  }
  if ("BETTER_AUTH_SECRET" in vars || "ADMIN_BOOTSTRAP_TOKEN" in vars) {
    fail("secrets must not appear in preview vars.");
  }
  const bootstrapEnabled = vars.ADMIN_BOOTSTRAP_ENABLED === "true";
  if (vars.ADMIN_BOOTSTRAP_ENABLED !== "false" && !bootstrapEnabled) {
    fail("ADMIN_BOOTSTRAP_ENABLED must be exactly true or false.");
  }
  if (bootstrapEnabled !== requiredSecrets.includes("ADMIN_BOOTSTRAP_TOKEN")) {
    fail("ADMIN_BOOTSTRAP_TOKEN must be required exactly while bootstrap is enabled.");
  }

  const database = requiredBinding(preview.d1_databases, "DB", "preview D1");
  if (database.database_name !== previewDatabaseName || database.migrations_dir !== "migrations") {
    fail("preview DB must use the dedicated database name and migration directory.");
  }
  if (resolved) {
    if (!uuidPattern.test(database.database_id ?? "")) {
      fail("resolved preview config requires a valid D1 database ID.");
    }
  } else if (database.database_id !== undefined) {
    fail("the tracked preview template must not contain a D1 database ID.");
  }

  const bucket = requiredBinding(preview.r2_buckets, "EVIDENCE_FILES", "preview R2");
  if (bucket.bucket_name !== previewBucketName) {
    fail("preview R2 must use the dedicated bucket name.");
  }

  const migrationNames = (await readdir(resolve("migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (JSON.stringify(migrationNames) !== JSON.stringify(expectedMigrationNames)) {
    fail("the migration set must be exactly 0001 through 0010.");
  }
}

async function prepare() {
  const databaseId = process.env.PERMITPULSE_PREVIEW_D1_DATABASE_ID;
  if (!uuidPattern.test(databaseId ?? "")) {
    fail("PERMITPULSE_PREVIEW_D1_DATABASE_ID must be a valid D1 UUID.");
  }
  const origin = validateHttpsOrigin(
    process.env.PERMITPULSE_PREVIEW_ORIGIN,
    "PERMITPULSE_PREVIEW_ORIGIN",
  );
  const bootstrapEnabled = requireExactBoolean(
    process.env.PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED,
    "PERMITPULSE_PREVIEW_BOOTSTRAP_ENABLED",
  );
  const config = await readConfig(sourceConfigPath);
  config.env.preview.vars.BETTER_AUTH_URL = origin;
  config.env.preview.vars.ADMIN_BOOTSTRAP_ENABLED = bootstrapEnabled;
  config.env.preview.d1_databases[0].database_id = databaseId;
  config.env.preview.secrets.required = bootstrapEnabled === "true"
    ? ["BETTER_AUTH_SECRET", "ADMIN_BOOTSTRAP_TOKEN"]
    : ["BETTER_AUTH_SECRET"];
  await validateConfig(config, { resolved: true });
  await writeFile(resolvedConfigPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log("Prepared ignored preview config with validated bindings and redacted secrets.");
}

async function preflight() {
  const configArgumentIndex = process.argv.indexOf("--config");
  const configPath = configArgumentIndex >= 0
    ? resolve(process.argv[configArgumentIndex + 1] ?? "")
    : sourceConfigPath;
  const resolved = process.argv.includes("--resolved");
  const config = await readConfig(configPath);
  await validateConfig(config, { resolved });
  console.log(
    resolved
      ? "Preview deployment preflight passed for the resolved ignored config."
      : "Preview deployment template preflight passed; no resource ID or secret value is tracked.",
  );
}

async function preflightSecretFile() {
  let fileMode;
  let content;
  try {
    const metadata = await stat(initialSecretsPath);
    fileMode = metadata.mode & 0o777;
    content = await readFile(initialSecretsPath, "utf8");
  } catch {
    fail("the initial preview secrets file is missing.");
  }
  if ((fileMode & 0o077) !== 0) {
    fail("the initial preview secrets file must not be accessible by group or other users.");
  }
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  if (lines.length !== 1 || !lines[0].startsWith("BETTER_AUTH_SECRET=")) {
    fail("the initial preview secrets file must contain only BETTER_AUTH_SECRET.");
  }
  let value = lines[0].slice("BETTER_AUTH_SECRET=".length);
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  if (
    new TextEncoder().encode(value).byteLength < 32 ||
    value.toLowerCase().includes("replace-with") ||
    value.toLowerCase().includes("placeholder")
  ) {
    fail("BETTER_AUTH_SECRET in the initial secrets file is invalid.");
  }
  console.log("Initial preview secrets file preflight passed without printing its value.");
}

const command = process.argv[2];
try {
  if (command === "prepare") await prepare();
  else if (command === "preflight") await preflight();
  else if (command === "secret-file") await preflightSecretFile();
  else fail("expected the prepare, preflight, or secret-file command.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Preview deployment preflight failed.");
  process.exitCode = 1;
}
