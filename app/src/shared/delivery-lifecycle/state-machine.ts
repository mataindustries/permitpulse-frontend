import type { DeliveryEventType, DeliveryState } from "./types";

export const deliveryTransitions = {
  draft: { packet_generated: "packet_generated" },
  packet_generated: {
    review_started: "under_review",
    packet_generated: "packet_generated",
  },
  under_review: {
    changes_requested: "changes_required",
    approved_for_delivery: "approved_for_delivery",
    packet_generated: "packet_generated",
  },
  changes_required: { packet_generated: "packet_generated" },
  approved_for_delivery: {
    delivery_recorded: "delivered",
    packet_generated: "packet_generated",
  },
  delivered: { delivery_confirmed: "delivery_confirmed" },
  delivery_confirmed: {},
} as const satisfies Record<DeliveryState, Partial<Record<DeliveryEventType, DeliveryState>>>;

export function resultingDeliveryState(
  state: DeliveryState,
  event: DeliveryEventType,
): DeliveryState | null {
  return (deliveryTransitions[state] as Partial<Record<DeliveryEventType, DeliveryState>>)[event] ?? null;
}

export function nextDeliveryEvents(state: DeliveryState): DeliveryEventType[] {
  return Object.keys(deliveryTransitions[state]) as DeliveryEventType[];
}
