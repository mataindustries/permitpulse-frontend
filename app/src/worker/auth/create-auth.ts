import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin as adminPlugin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/admin/access";
import { drizzle } from "drizzle-orm/d1";
import { authSchema } from "../db/schema";
import type { Bindings } from "../types";
import { getAuthRuntimeConfig } from "./config";

const adminAccessControl = createAccessControl(defaultStatements);
const adminRole = adminAccessControl.newRole(adminAc.statements);
const clientRole = adminAccessControl.newRole({
  user: [],
  session: [],
});

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
        banned: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
          returned: false,
        },
        banReason: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        banExpires: {
          type: "date",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    plugins: [
      adminPlugin({
        ac: adminAccessControl,
        roles: {
          admin: adminRole,
          client: clientRole,
        },
        defaultRole: "client",
        adminRoles: ["admin"],
      }),
    ],
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
