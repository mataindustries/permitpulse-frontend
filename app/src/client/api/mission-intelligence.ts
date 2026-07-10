import { requestJson } from "./cases";
import type { MissionIntelligence } from "../types/mission-intelligence";

export async function getMissionIntelligence(
  caseId: string,
): Promise<MissionIntelligence> {
  const data = await requestJson<{ intelligence: MissionIntelligence }>(
    `/api/v1/mission-intelligence/${encodeURIComponent(caseId)}`,
  );

  return data.intelligence;
}

