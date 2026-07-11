import { requestJson } from "./cases";
import type { ReviewerWorkspace } from "../../shared/reviewer/types";

export async function getReviewerWorkspace(caseId: string): Promise<ReviewerWorkspace> {
  return (await requestJson<{workspace:ReviewerWorkspace}>(`/api/v1/cases/${encodeURIComponent(caseId)}/reviewer`)).workspace;
}
export async function saveReviewerObject(caseId: string, path: string, value: unknown, id?: string): Promise<ReviewerWorkspace> {
  return (await requestJson<{workspace:ReviewerWorkspace}>(`/api/v1/cases/${encodeURIComponent(caseId)}/reviewer/${path}${id ? `/${encodeURIComponent(id)}` : ""}`, { method:id ? "PUT" : "POST", headers:{"content-type":"application/json"}, body:JSON.stringify(value) })).workspace;
}
export async function saveActionKit(caseId:string,value:unknown):Promise<ReviewerWorkspace>{
  return (await requestJson<{workspace:ReviewerWorkspace}>(`/api/v1/cases/${encodeURIComponent(caseId)}/reviewer/action-kit`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(value)})).workspace;
}
