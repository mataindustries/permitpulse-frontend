import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { WorkerEnv } from "../types";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  request_id: string;
}

export function errorResponse(
  context: Context<WorkerEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
) {
  return context.json<ApiErrorBody>(
    {
      ok: false,
      error: {
        code,
        message,
      },
      request_id: context.get("requestId"),
    },
    status,
  );
}
