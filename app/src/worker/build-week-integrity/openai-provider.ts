import { z } from "zod";

const responsesEndpoint = "https://api.openai.com/v1/responses";
const maximumResponseBytes = 512 * 1024;

const responseEnvelopeSchema = z
  .object({
    id: z.string().min(1).max(160),
    status: z.string(),
    incomplete_details: z
      .object({ reason: z.string().optional() })
      .passthrough()
      .nullable()
      .optional(),
    output: z
      .array(
        z
          .object({
            type: z.string(),
            content: z
              .array(
                z
                  .object({
                    type: z.string(),
                    text: z.string().optional(),
                    refusal: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export class OpenAIIntegrityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenAIIntegrityError";
    this.code = code;
  }
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maximumResponseBytes) {
    throw new OpenAIIntegrityError(
      "OPENAI_RESPONSE_TOO_LARGE",
      "The OpenAI response exceeded the configured safety limit.",
    );
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maximumResponseBytes) {
        throw new OpenAIIntegrityError(
          "OPENAI_RESPONSE_TOO_LARGE",
          "The OpenAI response exceeded the configured safety limit.",
        );
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function outputText(value: z.infer<typeof responseEnvelopeSchema>): string {
  if (value.status !== "completed") {
    throw new OpenAIIntegrityError(
      "OPENAI_RESPONSE_INCOMPLETE",
      `The OpenAI response was not completed (${value.incomplete_details?.reason ?? value.status}).`,
    );
  }

  for (const item of value.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw new OpenAIIntegrityError(
          "OPENAI_RESPONSE_REFUSED",
          "The OpenAI model declined the integrity review request.",
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new OpenAIIntegrityError(
    "OPENAI_RESPONSE_MISSING_OUTPUT",
    "The OpenAI response contained no structured output text.",
  );
}

function rejectedRequestError(response: Response, bodyText: string) {
  if (response.status === 429) {
    let providerCode: string | null | undefined;

    try {
      const parsed = errorEnvelopeSchema.safeParse(JSON.parse(bodyText));
      providerCode = parsed.success ? parsed.data.error.code : undefined;
    } catch {
      providerCode = undefined;
    }

    if (providerCode === "insufficient_quota") {
      return new OpenAIIntegrityError(
        "OPENAI_INSUFFICIENT_QUOTA",
        "The OpenAI project has insufficient quota for this integrity review.",
      );
    }

    return new OpenAIIntegrityError(
      "OPENAI_RATE_LIMITED",
      "The OpenAI Responses API rate-limited this integrity review.",
    );
  }

  return new OpenAIIntegrityError(
    "OPENAI_REQUEST_REJECTED",
    `The OpenAI Responses API returned HTTP ${response.status}.`,
  );
}

export async function requestOpenAIStructuredOutput<T>(input: {
  apiKey: string;
  instructions: string;
  input: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  model: string;
  schemaName: string;
  parse: (value: unknown) => T;
}): Promise<{ output: T; responseId: string }> {
  let response: Response;

  try {
    response = await fetch(responsesEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        instructions: input.instructions,
        input: input.input,
        max_output_tokens: input.maxOutputTokens,
        reasoning: { effort: "medium" },
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            strict: true,
            schema: input.jsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new OpenAIIntegrityError(
      "OPENAI_REQUEST_FAILED",
      "The OpenAI Responses API request failed.",
    );
  }

  const bodyText = await readBoundedResponse(response);
  if (!response.ok) {
    throw rejectedRequestError(response, bodyText);
  }

  let envelopeValue: unknown;
  try {
    envelopeValue = JSON.parse(bodyText) as unknown;
  } catch {
    throw new OpenAIIntegrityError(
      "OPENAI_RESPONSE_INVALID_JSON",
      "The OpenAI response was not valid JSON.",
    );
  }

  const envelope = responseEnvelopeSchema.safeParse(envelopeValue);
  if (!envelope.success) {
    throw new OpenAIIntegrityError(
      "OPENAI_RESPONSE_INVALID",
      "The OpenAI response envelope was invalid.",
    );
  }

  let structuredValue: unknown;
  try {
    structuredValue = JSON.parse(outputText(envelope.data)) as unknown;
  } catch (error) {
    if (error instanceof OpenAIIntegrityError) throw error;
    throw new OpenAIIntegrityError(
      "OPENAI_OUTPUT_INVALID_JSON",
      "The OpenAI structured output was not valid JSON.",
    );
  }

  let parsed: T;
  try {
    parsed = input.parse(structuredValue);
  } catch (error) {
    if (error instanceof OpenAIIntegrityError) throw error;
    throw new OpenAIIntegrityError(
      "OPENAI_OUTPUT_SCHEMA_INVALID",
      "The OpenAI structured output did not match the required schema.",
    );
  }

  return { output: parsed, responseId: envelope.data.id };
}
