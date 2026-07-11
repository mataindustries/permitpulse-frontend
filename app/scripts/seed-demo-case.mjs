const configuredUrl = process.env.PERMITPULSE_LOCAL_URL ?? "http://localhost:5173";
const email = process.env.PERMITPULSE_DEMO_ADMIN_EMAIL;
const password = process.env.PERMITPULSE_DEMO_ADMIN_PASSWORD;

let baseUrl;
try {
  const parsed = new URL(configuredUrl);
  const originOnly = parsed.username === "" && parsed.password === "" &&
    parsed.pathname === "/" && parsed.search === "" && parsed.hash === "";
  if (!originOnly || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new Error();
  baseUrl = parsed.origin;
} catch {
  console.error(`Invalid origin: PERMITPULSE_LOCAL_URL must be an http(s) origin with no path, query, or credentials. Received ${JSON.stringify(configuredUrl)}.`);
  process.exit(1);
}

if (!email || !password) {
  console.error("Set PERMITPULSE_DEMO_ADMIN_EMAIL and PERMITPULSE_DEMO_ADMIN_PASSWORD for an existing local admin.");
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
  console.error(`App server not running: could not connect to ${baseUrl}. Start the local app, then rerun the seed command.`);
  process.exit(1);
}
if (!signIn.ok) {
  const payload = await readPayload(signIn);
  const code = payload && typeof payload === "object" && "code" in payload ? String(payload.code) : "";
  if (code.includes("ORIGIN") || signIn.status === 403) {
    console.error(`Invalid origin: Better Auth rejected ${baseUrl}. Use the origin configured by BETTER_AUTH_URL (normally http://localhost:5173).`);
  } else if (signIn.status === 401 || code.includes("CREDENTIAL") || code.includes("PASSWORD")) {
    console.error("Invalid credentials: the local admin email or password was not accepted.");
  } else {
    console.error(`Local authentication failed (${signIn.status}): ${JSON.stringify(payload)}.`);
  }
  process.exit(1);
}
const cookie = signIn.headers.get("set-cookie")?.split(";",1)[0];
if (!cookie) {
  console.error("Local sign-in did not return a session cookie.");
  process.exit(1);
}
let seeded;
try {
  seeded = await fetch(`${baseUrl}/api/dev/cases/demo/arroyo-vista`, {
    method:"POST",
    headers:{cookie,origin:baseUrl},
  });
} catch {
  console.error(`App server stopped responding: could not connect to ${baseUrl} after authentication.`);
  process.exit(1);
}
const payload = await readPayload(seeded);
if (!seeded.ok) {
  if (seeded.status === 403) {
    console.error("Authenticated user is not admin: the demo seed endpoint requires the local admin role.");
  } else if (seeded.status === 401) {
    console.error("Authentication session was not accepted by the demo seed endpoint. Sign in again with the local admin account.");
  } else if (seeded.status === 404) {
    console.error("Local demo seed endpoint is unavailable. Confirm APP_ENV=local, ENABLE_DEV_CASE_API=true, and a loopback local URL.");
  } else {
    console.error(`Demo seed failed (${seeded.status}): ${JSON.stringify(payload)}`);
  }
  process.exit(1);
}
console.log(JSON.stringify(payload.data, null, 2));
