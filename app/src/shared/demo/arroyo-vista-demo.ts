import type { CreateCaseInput, CreateEvidenceInput, CreateTimelineInput } from "../../worker/cases/validation";
import type { ActionInput, ActionKitInput, FindingInput, NoteInput, QuestionInput } from "../../worker/reviewer/validation";

export const arroyoVistaDemoPermitNumber = "DEMO-LADBS-2026-1842";

export const arroyoVistaDemoCase = {
  project_name: "DEMO — Fictional Arroyo Vista ADU Resubmittal",
  client_name: "Northline Residential Studio — Fictional Demo",
  address: "1842 Arroyo Vista Drive",
  city: "Los Angeles, CA 90042",
  jurisdiction: "Los Angeles Department of Building and Safety — Demo Record",
  permit_number: arroyoVistaDemoPermitNumber,
  current_status: "ready_for_review",
} satisfies CreateCaseInput;

export interface DemoEvidence extends CreateEvidenceInput {
  key: string;
  verification_status: "verified" | "unverified";
}

export const arroyoVistaDemoEvidence: readonly DemoEvidence[] = [
  { key:"portal", evidence_type:"portal", title:"DEMO — Permit portal status capture", summary:"Fictional portal capture shows “Corrections Issued” even though a later resubmittal receipt is present. The display may be stale and does not identify an assigned reviewer.", source_url:"https://records.demo-ladbs.example/permits/DEMO-LADBS-2026-1842/status", source_label:"LADBS Demo Permit Portal", source_date:"2026-05-28", verification_status:"verified" },
  { key:"corrections", evidence_type:"document", title:"DEMO — Correction notice, cycle 1", summary:"Fictional correction notice requests structural response revisions, updated energy forms, and confirmation of planning clearances for the detached ADU and garage conversion.", source_url:"https://documents.demo-permitpulse.example/arroyo-vista/correction-notice-cycle-1.pdf", source_label:"Demo correction notice", source_date:"2026-04-09", verification_status:"verified" },
  { key:"receipt", evidence_type:"document", title:"DEMO — Resubmittal confirmation receipt", summary:"Fictional intake receipt confirms that revised plans and response documents were uploaded under the demo permit record; it does not confirm routing to a reviewer or discipline queue.", source_url:"https://receipts.demo-ladbs.example/resubmittals/DEMO-RS-2026-0518", source_label:"LADBS Demo ePlan receipt", source_date:"2026-05-18", verification_status:"verified" },
  { key:"structural", evidence_type:"document", title:"DEMO — Structural response letter", summary:"Fictional engineer response addresses the cycle-one structural comments and references revised sheets S1.1, S2.0, and S3.1.", source_url:"https://documents.demo-permitpulse.example/arroyo-vista/structural-response-2026-05-15.pdf", source_label:"Fictional Arroyo Structural Engineering", source_date:"2026-05-15", verification_status:"verified" },
  { key:"energy", evidence_type:"document", title:"DEMO — Energy compliance package", summary:"Fictional client-provided CF1R and supporting energy calculations are labeled for the revised ADU scope. Agency acceptance is not independently confirmed.", source_url:"https://client-files.demo-permitpulse.example/arroyo-vista/energy-compliance-revised.pdf", source_label:"Client-provided demo file", source_date:"2026-05-14", verification_status:"unverified" },
  { key:"client-inquiry", evidence_type:"email", title:"DEMO — Client status inquiry", summary:"Fictional client email asks whether the revised package returned to the original reviewer and whether any additional fee or form remains outstanding.", source_url:null, source_label:"Client-provided email summary", source_date:"2026-05-27", verification_status:"unverified" },
  { key:"reviewer-email", evidence_type:"email", title:"DEMO — Reviewer routing email note", summary:"Fictional email note says intake was completed and routing would follow, but the copied note omits the original message headers and final recipient list.", source_url:null, source_label:null, source_date:"2026-05-20", verification_status:"unverified" },
  { key:"zoning", evidence_type:"code_reference", title:"DEMO — Parcel and zoning reference", summary:"Fictional public-record reference identifies the demo parcel as R1 zoning and flags the information for confirmation against the current planning record before reliance.", source_url:"https://zoning.demo-lacity.example/parcels/fictional-1842-arroyo-vista", source_label:"Los Angeles Demo Zoning Map", source_date:"2026-05-12", verification_status:"verified" },
  { key:"analyst", evidence_type:"other", title:"DEMO — Internal analyst chronology note", summary:"Fictional analyst note reconciles the correction, upload, and intake dates and identifies reviewer assignment as the narrow unresolved issue. This is analysis, not an agency determination.", source_url:null, source_label:"PermitPulse internal demo analysis", source_date:"2026-05-29", verification_status:"unverified" },
] as const;

export interface DemoTimeline extends Omit<CreateTimelineInput, "evidence_ids"> { key:string; evidence_keys:readonly string[] }
export const arroyoVistaDemoTimeline: readonly DemoTimeline[] = [
  { key:"submission", occurred_on:"2026-03-12", timeline_type:"submission", title:"DEMO — Initial plans submitted", details:"Fictional detached ADU and garage-conversion plan set entered the demo agency workflow.", is_canonical:true, evidence_keys:["portal"] },
  { key:"corrections", occurred_on:"2026-04-09", timeline_type:"correction", title:"DEMO — Cycle-one corrections issued", details:"Structural, energy, and clearance responses were requested in the fictional correction notice.", is_canonical:true, evidence_keys:["corrections"] },
  { key:"revisions", occurred_on:"2026-05-15", timeline_type:"status_update", title:"DEMO — Revised response package completed", details:"The fictional design team completed the revised plans, structural response, and energy package.", is_canonical:true, evidence_keys:["structural","energy"] },
  { key:"uploaded", occurred_on:"2026-05-18", timeline_type:"resubmission", title:"DEMO — Resubmittal uploaded", details:"The revised fictional package was uploaded under the demo permit identifier.", is_canonical:true, evidence_keys:["receipt","structural","energy"] },
  { key:"intake", occurred_on:"2026-05-20", timeline_type:"status_update", title:"DEMO — Intake receipt acknowledged", details:"A fictional routing note indicates intake completion, but provenance is incomplete and reviewer assignment is not shown.", is_canonical:true, evidence_keys:["receipt","reviewer-email"] },
  { key:"client-followup", occurred_on:"2026-05-27", timeline_type:"applicant_contact", title:"DEMO — Client requested status confirmation", details:"The fictional client asked for assignment, outstanding-item, and review-window confirmation.", is_canonical:true, evidence_keys:["client-inquiry"] },
  { key:"reviewer-inquiry", occurred_on:"2026-05-29", timeline_type:"reviewer_contact", title:"DEMO — Targeted reviewer inquiry prepared", details:"PermitPulse prepared a focused fictional inquiry rather than recommending a duplicate submission.", is_canonical:true, evidence_keys:["analyst","portal","receipt"] },
  { key:"waiting", occurred_on:"2026-06-02", timeline_type:"status_update", title:"DEMO — Awaiting routing confirmation", details:"Current fictional waiting state: receipt is documented, while reviewer or discipline ownership remains unconfirmed.", is_canonical:true, evidence_keys:["portal","receipt","analyst"] },
] as const;

export type DemoFinding = Omit<FindingInput,"evidence_ids"|"timeline_ids"> & { key:string; evidence_keys:readonly string[]; timeline_keys:readonly string[] };
export const arroyoVistaDemoFindings: readonly DemoFinding[] = [
  { key:"receipt-not-assignment", title:"Receipt does not establish reviewer assignment", finding_type:"risk", severity:"high", summary:"The resubmittal receipt confirms upload and intake, but it does not prove that the package returned to the assigned reviewer.", evidence_keys:["receipt","reviewer-email"], timeline_keys:["uploaded","intake","waiting"], confidence:"high", recommended_resolution:"Ask intake to confirm the current reviewer and discipline queue using the demo permit and receipt identifiers.", internal_notes:"Internal only: keep the outreach narrow; do not imply the agency lost the plans.", approved:true },
  { key:"stale-portal", title:"Visible portal status may be stale", finding_type:"risk", severity:"medium", summary:"The portal still displays a correction-stage status that predates the documented resubmittal receipt.", evidence_keys:["portal","receipt"], timeline_keys:["corrections","uploaded","waiting"], confidence:"high", recommended_resolution:"Request confirmation of the authoritative internal status and the date of the latest routing action.", internal_notes:"", approved:true },
  { key:"discipline-unclear", title:"One discipline response remains unclear", finding_type:"risk", severity:"medium", summary:"The structural response is documented, but the available record does not establish whether energy or another discipline has accepted its response.", evidence_keys:["corrections","structural","energy"], timeline_keys:["corrections","revisions","uploaded"], confidence:"medium", recommended_resolution:"Confirm whether every cycle-one discipline response is complete and whether any fee, form, or clearance remains open.", internal_notes:"Internal only: the energy file is client-provided; avoid describing it as agency-accepted.", approved:true },
  { key:"targeted-followup", title:"Record supports targeted follow-up", finding_type:"strength", severity:"low", summary:"The documented upload and response package support a targeted routing inquiry rather than a new or duplicate submission.", evidence_keys:["receipt","structural","analyst"], timeline_keys:["uploaded","reviewer-inquiry"], confidence:"high", recommended_resolution:"Use the prepared follow-up language and preserve the existing receipt trail.", internal_notes:"", approved:true },
] as const;

export const arroyoVistaDemoQuestions: readonly (QuestionInput & {key:string})[] = [
  { key:"assignment", question:"Has the resubmittal been assigned back to the original reviewer?", why_it_matters:"Assignment confirms accountable ownership and the correct follow-up contact.", evidence_requested:"Current reviewer name, routing date, and assigned queue.", assigned_reviewer:"PermitPulse Demo Reviewer", status:"open", publishable:true },
  { key:"discipline", question:"Is another department or discipline holding the review?", why_it_matters:"A parallel discipline hold may explain the unchanged public status.", evidence_requested:"List of active discipline queues and their latest action dates.", assigned_reviewer:"PermitPulse Demo Reviewer", status:"open", publishable:true },
  { key:"outstanding", question:"Are any fees, forms, clearances, or correction responses still outstanding?", why_it_matters:"An incomplete intake item can prevent routing even after an upload receipt is issued.", evidence_requested:"Outstanding-item checklist or written confirmation that intake is complete.", assigned_reviewer:"PermitPulse Demo Reviewer", status:"open", publishable:true },
  { key:"portal-current", question:"Is the visible permit portal status current?", why_it_matters:"The displayed correction status predates the documented resubmittal.", evidence_requested:"Authoritative internal status and last status-change timestamp.", assigned_reviewer:"PermitPulse Demo Reviewer", status:"waiting", publishable:true },
  { key:"window", question:"What is the current estimated review window?", why_it_matters:"A routing-aware estimate supports accurate client expectations without promising an agency outcome.", evidence_requested:"Current queue estimate or next expected review milestone.", assigned_reviewer:"PermitPulse Demo Reviewer", status:"open", publishable:true },
] as const;

export type DemoAction = Omit<ActionInput,"evidence_ids"> & {key:string; evidence_keys:readonly string[]};
export const arroyoVistaDemoActions: readonly DemoAction[] = [
  { key:"confirm-assignment", priority:"critical", description:"Confirm receipt, routing date, and current reviewer assignment using the prepared demo identifiers.", evidence_keys:["receipt","reviewer-email"], estimated_impact:"Resolves the primary ownership uncertainty and directs the next contact.", responsible_party:"PermitPulse Demo Reviewer", due_date:"2026-06-05", approved:true },
  { key:"discipline-block", priority:"high", description:"Ask whether another discipline or clearance is blocking the resubmittal review.", evidence_keys:["corrections","structural","energy"], estimated_impact:"Identifies any parallel queue that requires a targeted response.", responsible_party:"PermitPulse Demo Reviewer", due_date:"2026-06-05", approved:true },
  { key:"outstanding-items", priority:"high", description:"Verify whether any fee, form, clearance, or correction response remains outstanding.", evidence_keys:["corrections","receipt"], estimated_impact:"Prevents avoidable delay from an incomplete intake requirement.", responsible_party:"Northline Residential Studio — Fictional Demo", due_date:"2026-06-06", approved:true },
  { key:"followup-language", priority:"medium", description:"Use the prepared concise follow-up language and preserve the agency response as new evidence.", evidence_keys:["client-inquiry","analyst"], estimated_impact:"Creates a clear, auditable request without duplicating the submission.", responsible_party:"PermitPulse Demo Reviewer", due_date:"2026-06-06", approved:true },
  { key:"regenerate", priority:"medium", description:"Regenerate the packet after new agency routing information is received and rerun the quality gate.", evidence_keys:["portal","receipt"], estimated_impact:"Keeps the client-facing packet synchronized with the authoritative record.", responsible_party:"PermitPulse Demo Reviewer", due_date:null, approved:true },
] as const;

export const arroyoVistaDemoNotes: readonly (NoteInput & {key:string})[] = [
  { key:"tone", commentary:"Internal only: use neutral routing language and do not characterize the fictional agency as delayed until assignment is confirmed.", publishable:false },
  { key:"provenance", commentary:"Internal only: reviewer email headers are incomplete; rely on the receipt for upload confirmation and treat the email only as a routing clue.", publishable:false },
] as const;

export const arroyoVistaDemoActionKit = {
  current_position:"The fictional revised package is documented as received, but current reviewer or discipline routing is not confirmed.",
  confirmed_record:"The record confirms the cycle-one corrections, revised structural response, energy package, and resubmittal receipt.",
  unconfirmed_record:"The record does not confirm the assigned reviewer, active discipline queue, acceptance of every response, or whether another intake item remains open.",
  primary_blocker:"Reviewer or discipline ownership after intake remains unconfirmed.",
  why_appropriate:"A narrow routing inquiry uses the documented receipt trail and can identify an outstanding response without creating a duplicate submission.",
  evidence_readiness:"Ready for follow-up: receipt and response documents are indexed; the energy package remains labeled unverified.",
  review_readiness:"Ready for targeted agency confirmation; not ready to represent routing or full discipline acceptance as confirmed.",
  email_subject:"DEMO — Routing confirmation request for DEMO-LADBS-2026-1842",
  recipient_role:"Fictional LADBS intake coordinator or assigned plan-check role",
  message_body:"Hello — this is a fictional demo follow-up regarding DEMO-LADBS-2026-1842. The record shows a revised package receipt dated May 18, 2026. Please confirm the current reviewer or discipline routing and whether any fee, form, clearance, or correction response remains outstanding. Thank you.",
  requested_confirmations:["Current assigned reviewer or responsible agency role","Current discipline queue and routing date","Whether any fee, form, clearance, or correction response remains outstanding","Current review window or next expected milestone"],
  call_checklist:["State that this is a status and routing confirmation, not a duplicate submission","Provide the fictional permit identifier and May 18 receipt date","Record the responder's role and the date of the response","Ask for written confirmation when available"],
  documents_ready:["DEMO resubmittal confirmation receipt","DEMO cycle-one correction notice","DEMO structural response letter","DEMO energy compliance package"],
  escalation_trigger:"Escalate to the fictional plan-check supervisor role only if routing remains unconfirmed after the follow-up review date or the agency identifies conflicting ownership.",
  follow_up_date:"2026-06-09", evidence_ids:[], timeline_ids:[], internal_note:"Internal only: do not characterize the fictional agency as delayed or imply that the submission was lost.", approved:true,
} satisfies ActionKitInput;
