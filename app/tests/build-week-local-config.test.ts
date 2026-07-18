import { describe, expect, it } from "vitest";
import packageJsonSource from "../package.json?raw";
import wranglerSource from "../wrangler.jsonc?raw";

const packageJson = JSON.parse(packageJsonSource) as {
  scripts: Record<string, string>;
};

const wrangler = JSON.parse(wranglerSource) as {
  vars: Record<string, string>;
  env: Record<
    string,
    {
      secrets?: { required: string[] };
      vars: Record<string, string>;
      d1_databases?: Array<{ binding: string }>;
      r2_buckets?: Array<{ binding: string }>;
    }
  >;
};

describe("Build Week local runtime configuration", () => {
  it("selects an isolated local Cloudflare environment for the demo scripts", () => {
    expect(packageJson.scripts["dev:build-week"]).toBe(
      "CLOUDFLARE_ENV=build-week-local vite",
    );
    expect(packageJson.scripts["db:migrate:build-week-local"]).toBe(
      "wrangler d1 migrations apply DB --env build-week-local --local",
    );
    expect(packageJson.scripts["dev:build-week:live"]).toBe(
      "CLOUDFLARE_ENV=build-week-live-local vite",
    );
    expect(packageJson.scripts["db:migrate:build-week-live-local"]).toBe(
      "wrangler d1 migrations apply DB --env build-week-live-local --local",
    );
  });

  it("enables only the local demo surface while keeping live AI opt-in", () => {
    const local = wrangler.env["build-week-local"];

    expect(local.vars).toMatchObject({
      APP_ENV: "local",
      AUTH_ALLOW_SIGNUP: "true",
      AUTH_ENABLED: "true",
      BUILD_WEEK_DEMO_MODE: "true",
      BUILD_WEEK_INTEGRITY_ENABLED: "true",
      ENABLE_DEV_CASE_API: "true",
    });
    expect(local.vars.BUILD_WEEK_INTEGRITY_LIVE_ENABLED).toBe("false");
    expect(local.secrets?.required).toEqual(["BETTER_AUTH_SECRET"]);
    expect(local.d1_databases).toEqual([
      expect.objectContaining({ binding: "DB" }),
    ]);
    expect(local.r2_buckets).toEqual([
      expect.objectContaining({ binding: "EVIDENCE_FILES" }),
    ]);
  });

  it("requires the OpenAI key only in the explicit live-local environment", () => {
    const liveLocal = wrangler.env["build-week-live-local"];

    expect(liveLocal.vars).toMatchObject({
      APP_ENV: "local",
      BUILD_WEEK_DEMO_MODE: "true",
      BUILD_WEEK_INTEGRITY_ENABLED: "true",
      BUILD_WEEK_INTEGRITY_LIVE_ENABLED: "true",
    });
    expect(liveLocal.secrets?.required).toEqual([
      "BETTER_AUTH_SECRET",
      "OPENAI_API_KEY",
    ]);
  });

  it("does not weaken production or preview live-AI defaults", () => {
    expect(wrangler.vars.BUILD_WEEK_INTEGRITY_ENABLED).toBe("false");
    expect(wrangler.vars.BUILD_WEEK_INTEGRITY_LIVE_ENABLED).toBe("false");
    expect(wrangler.env.preview.vars.BUILD_WEEK_INTEGRITY_LIVE_ENABLED).toBe(
      "false",
    );
  });
});
