import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, "migrations"),
      );

      return {
        wrangler: {
          configPath: "./wrangler.jsonc",
        },
        miniflare: {
          bindings: {
            APP_ENV: "local",
            AUTH_ALLOW_SIGNUP: "true",
            AUTH_ENABLED: "true",
            BETTER_AUTH_SECRET:
              "test-only-auth-secret-not-for-any-deployment-123456",
            BETTER_AUTH_URL: "http://localhost",
            ENABLE_DEV_CASE_API: "true",
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./tests/apply-migrations.ts"],
  },
});
