export const deliveryStates = [
  "draft",
  "packet_generated",
  "under_review",
  "changes_required",
  "approved_for_delivery",
  "delivered",
  "delivery_confirmed",
] as const;

export type DeliveryState = (typeof deliveryStates)[number];

export const deliveryEventTypes = [
  "packet_generated",
  "review_started",
  "changes_requested",
  "approved_for_delivery",
  "delivery_recorded",
  "delivery_confirmed",
] as const;

export type DeliveryEventType = (typeof deliveryEventTypes)[number];

export interface DeliveryActor {
  id: string;
  name: string | null;
}

export interface DeliveryEvent {
  id: string;
  case_id: string;
  event_type: DeliveryEventType;
  actor: DeliveryActor | null;
  created_at: string;
  note: string | null;
  packet_generation_id: string | null;
  packet_digest: string | null;
  case_version: number | null;
  previous_state: DeliveryState;
  resulting_state: DeliveryState;
  sequence: number;
}

export interface DeliveryLifecycle {
  case_id: string;
  current_state: DeliveryState;
  events: DeliveryEvent[];
  latest_event: DeliveryEvent | null;
  next_events: DeliveryEventType[];
  active_packet_generation_id: string | null;
  live_preview_differs: boolean;
}
