import type { DeliveryLifecycle } from "../../shared/delivery-lifecycle/types";
import type { DeliveryQualityEvaluation } from "../../shared/packet/quality-gate";
import type { PacketModel } from "../../shared/packet/types";
import { requestJson } from "./cases";

export interface PacketPresentationResponse {
  packet: PacketModel;
  quality: DeliveryQualityEvaluation;
  lifecycle: DeliveryLifecycle;
  export_supported: boolean;
  persisted_snapshot: boolean;
}

export function getPacketPresentation(
  caseId: string,
): Promise<PacketPresentationResponse> {
  return requestJson<PacketPresentationResponse>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/packet`,
  );
}
