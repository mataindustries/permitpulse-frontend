import type { Context } from "hono";
import type {
  PublicEnvironment,
  WorkerEnv,
} from "../types";

const publicEnvironments = new Set<PublicEnvironment>([
  "local",
  "preview",
  "production",
]);

export function getPublicEnvironment(value: string): PublicEnvironment {
  if (publicEnvironments.has(value as PublicEnvironment)) {
    return value as PublicEnvironment;
  }

  return "production";
}

export function isDevelopmentCaseApiEnabled(
  context: Context<WorkerEnv>,
): boolean {
  const hostname = new URL(context.req.url).hostname;
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  return (
    isLoopback &&
    context.env.APP_ENV === "local" &&
    context.env.ENABLE_DEV_CASE_API === "true"
  );
}

export function logDevelopmentError(
  context: Context<WorkerEnv>,
  message: string,
  error: unknown,
): void {
  if (getPublicEnvironment(context.env.APP_ENV) === "local") {
    console.error(message, error);
    return;
  }

  console.error(JSON.stringify({
    environment: getPublicEnvironment(context.env.APP_ENV),
    event: "worker_request_error",
    message,
    request_id: context.get("requestId"),
  }));
}
