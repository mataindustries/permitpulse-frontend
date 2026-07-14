const minimumTemporaryTokenBytes = 32;

export class TemporaryAuthorizationConfigurationError extends Error {
  constructor() {
    super("Temporary authorization configuration is invalid.");
    this.name = "TemporaryAuthorizationConfigurationError";
  }
}

function isValidConfiguredToken(token: string | undefined): token is string {
  if (!token || token !== token.trim()) return false;

  const normalized = token.toLowerCase();
  const tokenLength = new TextEncoder().encode(token).byteLength;

  return (
    tokenLength >= minimumTemporaryTokenBytes &&
    !normalized.includes("replace-with") &&
    !normalized.includes("placeholder")
  );
}

export function getBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length);

  return token.length > 0 ? token : null;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

export async function temporaryTokenMatches(
  configuredToken: string | undefined,
  suppliedToken: string | null,
): Promise<boolean> {
  if (!isValidConfiguredToken(configuredToken)) {
    throw new TemporaryAuthorizationConfigurationError();
  }

  if (!suppliedToken) return false;

  const [expected, actual] = await Promise.all([
    digest(configuredToken),
    digest(suppliedToken),
  ]);
  let difference = expected.length ^ actual.length;

  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ (actual[index] ?? 0);
  }

  return difference === 0;
}
