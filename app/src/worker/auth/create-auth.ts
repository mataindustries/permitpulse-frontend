import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/d1";
import { authSchema } from "../db/schema";
import type { Bindings } from "../types";
import { getAuthRuntimeConfig } from "./config";

export function createAuth(bindings: Bindings) {
  const config = getAuthRuntimeConfig(bindings);
  const database = drizzle(bindings.DB, { schema: authSchema });

  return betterAuth({
    appName: "PermitPulse Case Workspace",
    basePath: "/api/auth",
    baseURL: config.baseURL,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: !config.allowSignup,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "client",
          input: false,
          returned: false,
        },
      },
    },
    advanced: {
      cookiePrefix: "permitpulse",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secureCookies,
        path: "/",
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: config.secureCookies,
    },
  });
}
