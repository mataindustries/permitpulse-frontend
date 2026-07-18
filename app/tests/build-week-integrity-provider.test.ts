import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAIIntegrityError,
  requestOpenAIStructuredOutput,
} from "../src/worker/build-week-integrity/openai-provider";

const requestInput = {
  apiKey: "test-only-openai-key",
  instructions: "Return the requested test object.",
  input: "Test input.",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
  maxOutputTokens: 64,
  model: "gpt-5.6-terra",
  schemaName: "test_schema",
  parse: (value: unknown) => value,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function rejectedRequest(body: string, status = 429) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        headers: { "content-type": "application/json" },
        status,
      }),
    ),
  );

  try {
    await requestOpenAIStructuredOutput(requestInput);
  } catch (error) {
    expect(error).toBeInstanceOf(OpenAIIntegrityError);
    return error as OpenAIIntegrityError;
  }

  throw new Error("Expected the OpenAI request to be rejected.");
}

describe("Build Week OpenAI provider errors", () => {
  it("distinguishes insufficient quota without exposing the provider message", async () => {
    const error = await rejectedRequest(
      JSON.stringify({
        error: {
          code: "insufficient_quota",
          message: "sentinel provider detail that must remain private",
          type: "insufficient_quota",
        },
      }),
    );

    expect(error.code).toBe("OPENAI_INSUFFICIENT_QUOTA");
    expect(error.message).not.toContain("sentinel provider detail");
  });

  it("classifies ordinary 429 responses as rate limits", async () => {
    const error = await rejectedRequest(
      JSON.stringify({ error: { code: "rate_limit_exceeded" } }),
    );

    expect(error.code).toBe("OPENAI_RATE_LIMITED");
  });

  it("fails safely when a 429 response body is malformed", async () => {
    const error = await rejectedRequest("not-json");

    expect(error.code).toBe("OPENAI_RATE_LIMITED");
  });

  it("preserves the generic classification for other rejected requests", async () => {
    const error = await rejectedRequest(
      JSON.stringify({ error: { code: "model_not_found" } }),
      400,
    );

    expect(error).toMatchObject({
      code: "OPENAI_REQUEST_REJECTED",
      message: "The OpenAI Responses API returned HTTP 400.",
    });
  });
});
