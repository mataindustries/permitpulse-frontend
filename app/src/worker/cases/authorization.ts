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

export function createsOwnerParticipant(actor: CaseActor): boolean {
  return actor.role === "client";
}
