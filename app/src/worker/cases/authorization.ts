import type { AuthenticatedUser } from "../types";

export type CaseListScope = "all" | "participating";

export interface CaseActor {
  id: string;
  role: AuthenticatedUser["role"];
}

export function actorFromUser(user: AuthenticatedUser): CaseActor {
  return {
    id: user.id,
    role: user.role,
  };
}

export function canCreateCase(actor: CaseActor): boolean {
  return actor.role === "admin" || actor.role === "client";
}

export function caseListScope(actor: CaseActor): CaseListScope {
  return actor.role === "admin" ? "all" : "participating";
}

export function mayReadAnyCase(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayEditAnyCase(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayEditParticipatingCase(actor: CaseActor): boolean {
  return actor.role === "client";
}

export function mayTransitionCaseStatus(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function createsOwnerParticipant(actor: CaseActor): boolean {
  return actor.role === "client";
}

export function mayManageAnyEvidence(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayCreateClientEvidence(actor: CaseActor): boolean {
  return actor.role === "client";
}

export function maySetEvidenceVerification(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayManageAnyTimeline(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayCreateClientTimeline(actor: CaseActor): boolean {
  return actor.role === "client";
}

export function mayManageCanonicalTimeline(actor: CaseActor): boolean {
  return actor.role === "admin";
}

export function mayLinkAnyEvidenceToTimeline(actor: CaseActor): boolean {
  return actor.role === "admin";
}
