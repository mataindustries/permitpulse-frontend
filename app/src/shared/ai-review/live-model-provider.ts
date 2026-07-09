import { z } from "zod";
import { scanPacketReviewSafety } from "./redaction";
import { packetReviewDraftSchema } from "./schema";
import type { PacketReviewProvider } from "./provider";
import type { PacketReviewPromptContract } from "./prompt";
import type { PacketReviewDraft } from "./types";

const maximumProviderResponseBytes = 64 * 1024;

export interface LiveModelRequest {
  model: string;
  input: PacketReviewPromptContract;
  response_format: {
    type: "json_object";
    schema_name: "PacketReviewDraft";
  };
}

export interface LiveModelTransportInput {
  apiKey: string;
  endpoint: string;
  request: LiveModelRequest;
}

export type LiveModelTransport = (
  input: LiveModelTransportInput,
) => Promise<unknown>;

const liveModelResponseSchema = z
  .object({
    output: z.union([z.string(), z.record(z.string(), z.unknown())]),
  })
  .strict();

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      bytesRead += chunk.value.byteLength;
      if (bytesRead > maximumProviderResponseBytes) {
        throw new Error("Provider response exceeded the local safety limit.");
      }

      text += decoder.decode(chunk.value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export const workerLiveModelTransport: LiveModelTransport = async ({
  apiKey,
  endpoint,
  request,
}) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("The local model provider request failed.");
  }

  return JSON.parse(await readBoundedResponse(response)) as unknown;
};

export function prepareLiveModelRequest(
  prompt: PacketReviewPromptContract,
  model: string,
): LiveModelRequest {
  const promptScan = scanPacketReviewSafety(prompt);

  if (promptScan.blocked) {
    throw new Error("The prompt failed structured-field safety validation.");
  }

  return {
    model,
    input: prompt,
    response_format: {
      type: "json_object",
      schema_name: "PacketReviewDraft",
    },
  };
}

export function parseLiveModelDraft(value: unknown): PacketReviewDraft {
  const response = liveModelResponseSchema.parse(value);
  let candidate: unknown = response.output;

  if (typeof candidate === "string") {
    candidate = JSON.parse(candidate) as unknown;
  }

  return packetReviewDraftSchema.parse(candidate);
}

export function createLiveModelPacketReviewProvider(options: {
  apiKey: string;
  endpoint: string;
  model: string;
  transport?: LiveModelTransport;
}): PacketReviewProvider {
  const transport = options.transport ?? workerLiveModelTransport;

  return {
    name: "live-model-provider",
    liveAi: true,
    externalCalls: true,
    async createDraft(_packet, prompt) {
      const request = prepareLiveModelRequest(prompt, options.model);
      const response = await transport({
        apiKey: options.apiKey,
        endpoint: options.endpoint,
        request,
      });
      const draft = parseLiveModelDraft(response);

      return {
        ...draft,
        model_metadata: {
          reviewer: "live-model-provider",
          generated_at: prompt.packet.generated_at,
          local_only: true,
          version: "local-test-v1",
        },
      };
    },
  };
}
