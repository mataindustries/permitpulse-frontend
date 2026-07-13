import { requestJson } from "./cases";
import type { DeliveryEventType, DeliveryLifecycle } from "../types/delivery-lifecycle";

export async function getDeliveryLifecycle(caseId: string): Promise<DeliveryLifecycle> {
  const data = await requestJson<{ lifecycle: DeliveryLifecycle }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/delivery-lifecycle`,
  );
  return data.lifecycle;
}

export async function transitionDeliveryLifecycle(
  caseId: string,
  eventType: DeliveryEventType,
  note: string | null,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<DeliveryLifecycle> {
  const data = await requestJson<{ lifecycle: DeliveryLifecycle; retry: boolean }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/delivery-lifecycle/transitions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        idempotency_key: idempotencyKey,
        note,
      }),
    },
  );
  return data.lifecycle;
}
