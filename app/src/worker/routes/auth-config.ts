import { Hono } from "hono";
import { isAuthEnabled, isSignupEnabled } from "../auth/config";
import type { WorkerEnv } from "../types";

export const authConfigRoutes = new Hono<WorkerEnv>();

authConfigRoutes.get("/", (context) => {
  const enabled = isAuthEnabled(context.env);

  return context.json({
    ok: true,
    data: {
      enabled,
      signup_enabled: enabled && isSignupEnabled(context.env),
    },
  });
});
