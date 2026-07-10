import { requestJson } from "./cases";
import type { MissionControlListResponse } from "../types/mission-control";

export async function listMissionControl(options: {
  limit?: number;
  offset?: number;
} = {}): Promise<MissionControlListResponse> {
  const searchParams = new URLSearchParams();

  if (typeof options.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number" && options.offset > 0) {
    searchParams.set("offset", String(options.offset));
  }

  const query = searchParams.toString();

  return requestJson<MissionControlListResponse>(
    `/api/v1/mission-control${query ? `?${query}` : ""}`,
  );
}
