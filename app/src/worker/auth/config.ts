import { getPublicEnvironment } from "../lib/environment";
import type { Bindings } from "../types";

const minimumSecretBytes = 32;
const codespacesPreviewOrigin = "https://*.app.github.dev";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication configuration is invalid.");
    this.name = "AuthConfigurationError";
  }
}

export interface AuthRuntimeConfig {
  allowSignup: boolean;
  baseURL: string;
  secret: string;
  secureCookies: boolean;
  trustedOrigins: string[];
}

export function isAuthEnabled(bindings: Bindings): boolean {
  return bindings.AUTH_ENABLED === "true";
}

export function isSignupEnabled(bindings: Bindings): boolean {
  return (
    getPublicEnvironment(bindings.APP_ENV) === "local" &&
    bindings.AUTH_ALLOW_SIGNUP === "true"
  );
}

function isValidSecret(secret: string | undefined): secret is string {
  if (!secret || new TextEncoder().encode(secret).byteLength < minimumSecretBytes) {
    return false;
  }

  return !secret.toLowerCase().includes("replace-with");
}

function parseBaseURL(bindings: Bindings): URL {
  let parsed: URL;

  try {
    parsed = new URL(bindings.BETTER_AUTH_URL);
  } catch {
    throw new AuthConfigurationError();
  }

  const environment = getPublicEnvironment(bindings.APP_ENV);
  const isOriginOnly =
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.pathname === "/" &&
    parsed.search === "" &&
    parsed.hash === "";
  const isSecureForEnvironment =
    environment === "local"
      ? parsed.protocol === "http:" || parsed.protocol === "https:"
      : parsed.protocol === "https:";

  if (!isOriginOnly || !isSecureForEnvironment) {
    throw new AuthConfigurationError();
  }

  return parsed;
}

export function getAuthRuntimeConfig(
  bindings: Bindings,
): AuthRuntimeConfig {
  if (!isValidSecret(bindings.BETTER_AUTH_SECRET)) {
    throw new AuthConfigurationError();
  }

  const baseURL = parseBaseURL(bindings);
  const environment = getPublicEnvironment(bindings.APP_ENV);

  return {
    allowSignup: isSignupEnabled(bindings),
    baseURL: baseURL.origin,
    secret: bindings.BETTER_AUTH_SECRET,
    secureCookies: environment !== "local",
    trustedOrigins:
      environment === "local"
        ? [baseURL.origin, codespacesPreviewOrigin]
        : [baseURL.origin],
  };
}
