import type { CreateCaseInput, CreateEvidenceInput, CreateTimelineInput } from "../../worker/cases/validation";
import type { ActionInput, ActionKitInput, FindingInput, NoteInput, QuestionInput } from "../../worker/reviewer/validation";
import { buildWeekUnsupportedReassignmentFinding } from "../build-week-integrity/demo";

export const arroyoVistaDemoPermitNumber = "LADBS-FICTIONAL-2026-1842";
export const arroyoVistaDemoReviewerLabel = "PermitPulse Analyst";

export const arroyoVistaDemoCase = {
  project_name: "Arroyo Vista ADU Resubmittal",
  client_name: "Northline Residential Studio",
  address: "1842 Arroyo Vista Drive",
  city: "Los Angeles, CA 90042",
  jurisdiction: "Los Angeles Department of Building and Safety",
  permit_number: arroyoVistaDemoPermitNumber,
  current_status: "ready_for_review",
} satisfies CreateCaseInput;

export interface DemoEvidence extends CreateEvidenceInput {
  key: string;
  verification_status: "verified" | "unverified";
}

export const arroyoVistaDemoEvidence: readonly DemoEvidence[] = [
  { key:"portal", evidence_type:"portal", title:"Permit portal status capture", summary:"Portal status reflects Corrections Issued but does not identify the assigned reviewer. The status predates the documented resubmittal receipt.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/portal-status-2026-05-28", source_label:"LADBS permit portal record", source_date:"2026-05-28", verification_status:"verified" },
  { key:"corrections", evidence_type:"document", title:"Correction notice, cycle 1", summary:"Cycle-one corrections request structural revisions, updated energy forms, and confirmation of planning clearances for the ADU and garage conversion.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/correction-notice-cycle-1", source_label:"LADBS cycle-one correction notice", source_date:"2026-04-09", verification_status:"verified" },
  { key:"receipt", evidence_type:"document", title:"Resubmittal confirmation receipt", summary:"The intake receipt confirms upload of revised plans and response documents. It does not establish reviewer assignment or discipline routing.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/resubmittal-receipt-2026-05-18", source_label:"LADBS ePlan intake receipt", source_date:"2026-05-18", verification_status:"verified" },
  { key:"structural", evidence_type:"document", title:"Structural response letter", summary:"The engineer response addresses the cycle-one structural comments and references revised sheets S1.1, S2.0, and S3.1.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/structural-response-2026-05-15", source_label:"Arroyo Structural Engineering response letter", source_date:"2026-05-15", verification_status:"verified" },
  { key:"energy", evidence_type:"document", title:"Energy compliance package", summary:"The CF1R and supporting calculations are labeled for the revised ADU scope. Jurisdiction acceptance is not documented.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/energy-compliance-2026-05-14", source_label:"Client-provided energy compliance package", source_date:"2026-05-14", verification_status:"verified" },
  { key:"client-inquiry", evidence_type:"email", title:"Client status inquiry", summary:"The client requests confirmation of reviewer assignment and any outstanding fee, form, or clearance.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/client-inquiry-2026-05-27", source_label:"Client email record", source_date:"2026-05-27", verification_status:"verified" },
  { key:"reviewer-email", evidence_type:"email", title:"Reviewer routing email note", summary:"The email note records intake completion and anticipated routing. Original headers and the final recipient list are not available.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/routing-email-2026-05-20", source_label:"Agency routing email record", source_date:"2026-05-20", verification_status:"verified" },
  { key:"zoning", evidence_type:"code_reference", title:"Parcel and zoning reference", summary:"The retained public-record reference identifies R1 zoning. Current planning status requires jurisdiction confirmation before reliance.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/zoning-reference-2026-05-12", source_label:"Los Angeles parcel and zoning record", source_date:"2026-05-12", verification_status:"verified" },
  { key:"analyst", evidence_type:"other", title:"Analyst chronology note", summary:"The chronology reconciles correction, upload, and intake dates and identifies reviewer assignment as the principal unresolved issue. It is analysis, not an agency determination.", source_url:"https://workspace.getpermitpulse.com/records/fictional/arroyo-vista/analyst-chronology-2026-05-29", source_label:"PermitPulse case chronology", source_date:"2026-05-29", verification_status:"verified" },
] as const;

export interface DemoTimeline extends Omit<CreateTimelineInput, "evidence_ids"> { key:string; evidence_keys:readonly string[] }
export const arroyoVistaDemoTimeline: readonly DemoTimeline[] = [
  { key:"submission", occurred_on:"2026-03-12", timeline_type:"submission", title:"Initial plans submitted", details:"The detached ADU and garage-conversion plan set entered agency review.", is_canonical:true, evidence_keys:["portal"] },
  { key:"corrections", occurred_on:"2026-04-09", timeline_type:"correction", title:"Cycle-one corrections issued", details:"The correction notice requests structural, energy, and planning-clearance responses.", is_canonical:true, evidence_keys:["corrections"] },
  { key:"revisions", occurred_on:"2026-05-15", timeline_type:"status_update", title:"Revised response package completed", details:"The design team completed revised plans, the structural response, and the energy package.", is_canonical:true, evidence_keys:["structural","energy"] },
  { key:"uploaded", occurred_on:"2026-05-18", timeline_type:"resubmission", title:"Resubmittal uploaded", details:"The revised package was uploaded under the recorded permit identifier.", is_canonical:true, evidence_keys:["receipt","structural","energy"] },
  { key:"intake", occurred_on:"2026-05-20", timeline_type:"status_update", title:"Intake receipt acknowledged", details:"The routing note records intake completion but does not identify the assigned reviewer.", is_canonical:true, evidence_keys:["receipt","reviewer-email"] },
  { key:"client-followup", occurred_on:"2026-05-27", timeline_type:"applicant_contact", title:"Client requested status confirmation", details:"The client requested assignment, outstanding-item, and review-window confirmation.", is_canonical:true, evidence_keys:["client-inquiry"] },
  { key:"reviewer-inquiry", occurred_on:"2026-05-29", timeline_type:"reviewer_contact", title:"Targeted reviewer inquiry prepared", details:"A focused routing inquiry was prepared; no duplicate submission is recommended.", is_canonical:true, evidence_keys:["analyst","portal","receipt"] },
  { key:"waiting", occurred_on:"2026-06-02", timeline_type:"status_update", title:"Awaiting routing confirmation", details:"The receipt is documented; reviewer and discipline ownership remain unconfirmed.", is_canonical:true, evidence_keys:["portal","receipt","analyst"] },
] as const;

export type DemoFinding = Omit<FindingInput,"evidence_ids"|"timeline_ids"> & { key:string; evidence_keys:readonly string[]; timeline_keys:readonly string[] };
export const arroyoVistaDemoFindings: readonly DemoFinding[] = [
  { key:"receipt-not-assignment", title:"Receipt does not establish reviewer assignment", finding_type:"risk", severity:"high", summary:"The resubmittal receipt confirms upload and intake, but it does not prove that the package returned to the assigned reviewer.", evidence_keys:["receipt","reviewer-email"], timeline_keys:["uploaded","intake","waiting"], confidence:"high", recommended_resolution:"Ask intake to confirm the current reviewer and discipline queue using the permit and receipt identifiers.", internal_notes:"Internal only: keep the outreach narrow; do not imply the agency lost the plans.", approved:true },
  { key:"stale-portal", title:"Visible portal status may be stale", finding_type:"risk", severity:"medium", summary:"The portal still displays a correction-stage status that predates the documented resubmittal receipt.", evidence_keys:["portal","receipt"], timeline_keys:["corrections","uploaded","waiting"], confidence:"high", recommended_resolution:"Request confirmation of the authoritative internal status and the date of the latest routing action.", internal_notes:"", approved:true },
  { key:"discipline-unclear", title:"One discipline response remains unclear", finding_type:"risk", severity:"medium", summary:"The structural response is documented, but the available record does not establish whether energy or another discipline has accepted its response.", evidence_keys:["corrections","structural","energy"], timeline_keys:["corrections","revisions","uploaded"], confidence:"medium", recommended_resolution:"Confirm whether every cycle-one discipline response is complete and whether any fee, form, or clearance remains open.", internal_notes:"Internal only: the energy file is client-provided; avoid describing it as agency-accepted.", approved:true },
  { key:"targeted-followup", title:"Record supports targeted follow-up", finding_type:"strength", severity:"low", summary:"The documented upload and response package support a targeted routing inquiry rather than a new or duplicate submission.", evidence_keys:["receipt","structural","analyst"], timeline_keys:["uploaded","reviewer-inquiry"], confidence:"high", recommended_resolution:"Use the prepared follow-up language and preserve the existing receipt trail.", internal_notes:"", approved:true },
  buildWeekUnsupportedReassignmentFinding,
] as const;

export const arroyoVistaDemoQuestions: readonly (QuestionInput & {key:string})[] = [
  { key:"assignment", question:"Has the resubmittal been assigned back to the original reviewer?", why_it_matters:"Assignment confirms accountable ownership and the correct follow-up contact.", evidence_requested:"Current reviewer name, routing date, and assigned queue.", assigned_reviewer:"PermitPulse Reviewer", status:"open", publishable:true },
  { key:"discipline", question:"Is another department or discipline holding the review?", why_it_matters:"A parallel discipline hold may explain the unchanged public status.", evidence_requested:"List of active discipline queues and their latest action dates.", assigned_reviewer:"PermitPulse Reviewer", status:"open", publishable:true },
  { key:"outstanding", question:"Are any fees, forms, clearances, or correction responses still outstanding?", why_it_matters:"An incomplete intake item can prevent routing even after an upload receipt is issued.", evidence_requested:"Outstanding-item checklist or written confirmation that intake is complete.", assigned_reviewer:"PermitPulse Reviewer", status:"open", publishable:true },
  { key:"portal-current", question:"Is the visible permit portal status current?", why_it_matters:"The displayed correction status predates the documented resubmittal.", evidence_requested:"Authoritative internal status and last status-change timestamp.", assigned_reviewer:"PermitPulse Reviewer", status:"waiting", publishable:true },
  { key:"window", question:"What is the current estimated review window?", why_it_matters:"A routing-aware estimate supports accurate client expectations without promising an agency outcome.", evidence_requested:"Current queue estimate or next expected review milestone.", assigned_reviewer:"PermitPulse Reviewer", status:"open", publishable:true },
] as const;

export type DemoAction = Omit<ActionInput,"evidence_ids"> & {key:string; evidence_keys:readonly string[]};
export const arroyoVistaDemoActions: readonly DemoAction[] = [
  { key:"confirm-assignment", priority:"critical", description:"Confirm the receipt date, routing date, and current reviewer assignment using the recorded permit identifier.", evidence_keys:["receipt","reviewer-email"], estimated_impact:"Resolves the primary ownership uncertainty and directs the next contact.", responsible_party:"PermitPulse Reviewer", due_date:"2026-06-05", approved:true },
  { key:"discipline-block", priority:"high", description:"Ask whether another discipline or clearance is holding the resubmittal review.", evidence_keys:["corrections","structural","energy"], estimated_impact:"Identifies any parallel queue that requires a targeted response.", responsible_party:"PermitPulse Reviewer", due_date:"2026-06-05", approved:true },
  { key:"outstanding-items", priority:"high", description:"Confirm whether any fee, form, clearance, or correction response remains outstanding.", evidence_keys:["corrections","receipt"], estimated_impact:"Prevents avoidable delay from an incomplete intake requirement.", responsible_party:"Northline Residential Studio", due_date:"2026-06-06", approved:true },
  { key:"followup-language", priority:"medium", description:"Send the prepared follow-up and retain the agency response as evidence.", evidence_keys:["client-inquiry","analyst"], estimated_impact:"Creates a clear, auditable request without duplicating the submission.", responsible_party:"PermitPulse Reviewer", due_date:"2026-06-06", approved:true },
  { key:"regenerate", priority:"medium", description:"Regenerate the packet after new agency routing information is received and rerun the quality gate.", evidence_keys:["portal","receipt"], estimated_impact:"Keeps the client-facing packet synchronized with the authoritative record.", responsible_party:"PermitPulse Reviewer", due_date:null, approved:true },
] as const;

export const arroyoVistaDemoNotes: readonly (NoteInput & {key:string})[] = [
  { key:"tone", commentary:"Internal only: use neutral routing language and do not characterize the fictional agency as delayed until assignment is confirmed.", publishable:false },
  { key:"provenance", commentary:"Internal only: reviewer email headers are incomplete; rely on the receipt for upload confirmation and treat the email only as a routing clue.", publishable:false },
] as const;

export const arroyoVistaDemoActionKit = {
  current_position:"The revised package is documented as received; current reviewer and discipline routing are not confirmed.",
  confirmed_record:"The record confirms the cycle-one corrections, revised structural response, energy package, and resubmittal receipt.",
  unconfirmed_record:"The record does not confirm the assigned reviewer, active discipline queue, acceptance of every response, or whether another intake item remains open.",
  primary_blocker:"Reviewer or discipline ownership after intake remains unconfirmed.",
  why_appropriate:"A narrow routing inquiry uses the documented receipt trail and can identify an outstanding response without creating a duplicate submission.",
  evidence_readiness:"Packet evidence is delivery-ready: nine reviewed records include complete source details.",
  review_readiness:"The investigation supports targeted agency follow-up; reviewer assignment and discipline acceptance remain open.",
  email_subject:"Routing confirmation request — LADBS-FICTIONAL-2026-1842",
  recipient_role:"LADBS intake coordinator or assigned plan-check reviewer",
  message_body:"Hello, I am following up on permit LADBS-FICTIONAL-2026-1842 for 1842 Arroyo Vista Drive. Our record includes a revised-package receipt dated May 18, 2026. Please confirm the assigned reviewer, current discipline routing, and whether any fee, form, clearance, or correction response remains outstanding. If available, please also provide the latest routing date and expected review window. Thank you.",
  requested_confirmations:["Current assigned reviewer or responsible agency role","Current discipline queue and routing date","Whether any fee, form, clearance, or correction response remains outstanding","Current review window or next expected milestone"],
  call_checklist:["Identify the project by permit number, address, and May 18 receipt date","Confirm the assigned reviewer and every active discipline queue","Ask whether any intake item remains outstanding","Record the responder's name or role, response date, and stated next milestone","Request written confirmation when available"],
  documents_ready:["Resubmittal confirmation receipt","Cycle-one correction notice","Structural response letter","Energy compliance package"],
  escalation_trigger:"Escalate to the appropriate plan-check supervisor only if routing remains unconfirmed after the review date or the jurisdiction provides conflicting ownership information.",
  follow_up_date:"2026-06-09", evidence_ids:[], timeline_ids:[], internal_note:"Internal only: do not characterize the fictional agency as delayed or imply that the submission was lost.", approved:true,
} satisfies ActionKitInput;
