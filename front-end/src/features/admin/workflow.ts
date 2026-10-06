/**
 * M3.3C3 — Workflow transition + audit contract.
 *
 * Centralised definition of the admin workflow state machines (locked by
 * `SPONSORSHIP_WORKFLOW.md` §0 / `SPONSORSHIP_TECHNICAL_WORKFLOW.md` and the
 * M3.3A security contract). This module is the single source of truth for:
 *
 *  - which state transitions are valid per collection,
 *  - which roles may fire them (defence-in-depth; the Firestore rules remain
 *    the ultimate authority),
 *  - the audit field names written to `auditLogs`.
 *
 * No state machines are invented here — only the ones already defined in the
 * architecture are encoded.
 */
import type { UserRole } from "@/types";
import type { AdminActor } from "./catalogue";

/** Roles permitted to approve/reject/activate workflow state (requests/applications/approvals). */
export const WORKFLOW_ADMIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"];

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

/** Sponsorship REQUEST state machine (`sponsorshipRequests.status`). */
export type RequestStatus = "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED";

/** Sponsor APPLICATION state machine (`sponsorApplications.status`, informational only). */
export type ApplicationStatus =
  | "PENDING"
  | "REVIEWING"
  | "CONTACTED"
  | "CLOSED"
  | "REJECTED";

/** Request workflow actions (validated by the transition map). */
export type RequestAction = "review" | "approve" | "reject" | "reopen";

/** Application workflow actions (validated by the transition map). */
export type ApplicationAction = "review" | "contact" | "close" | "reject" | "reopen";

/**
 * Sponsor payment state machine (`sponsorApplications.paymentStatus`).
 *
 * PUBLIC create may only start a sponsorship as `INITIATED`. The `PAID` /
 * `FAILED` / `REFUNDED` transitions are server-side only: they follow
 * Razorpay order creation, checkout, webhook verification and refund events
 * in the future pay-gateway adapter (never from browser/admin UI code).
 */
export type PaymentStatus = "INITIATED" | "PAID" | "FAILED" | "REFUNDED";

/** All valid payment lifecycle values (locked; mirrors `PaymentStatus`). */
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "INITIATED",
  "PAID",
  "FAILED",
  "REFUNDED",
];

/** An actor holding the identity needed to audit a transition. */
export interface WorkflowActor extends AdminActor {
  uid: string;
  email?: string | null;
}

// ---------------------------------------------------------------------------
// Allowed transition maps (locked semantics; never invented)
// ---------------------------------------------------------------------------

export const REQUEST_TRANSITIONS: Record<RequestAction, readonly RequestStatus[]> = {
  // PENDING -> REVIEWING
  review: ["PENDING"],
  // REVIEWING -> APPROVED (creates the public profile atomically)
  approve: ["REVIEWING"],
  // PENDING | REVIEWING -> REJECTED
  reject: ["PENDING", "REVIEWING"],
  // REJECTED -> PENDING (re-open, audited)
  reopen: ["REJECTED"],
};

export const APPLICATION_TRANSITIONS: Record<ApplicationAction, readonly ApplicationStatus[]> = {
  // PENDING -> REVIEWING
  review: ["PENDING"],
  // REVIEWING -> CONTACTED
  contact: ["REVIEWING"],
  // (REVIEWING | CONTACTED) -> CLOSED (any non-terminal is allowed in-flow)
  close: ["PENDING", "REVIEWING", "CONTACTED"],
  // PENDING | REVIEWING -> REJECTED
  reject: ["PENDING", "REVIEWING"],
  // REJECTED -> PENDING (re-open, audited)
  reopen: ["REJECTED"],
};

/** Action label recorded in audit for athlete/group approval steps. */
export type ApprovalAction = "APPROVE" | "REJECT" | "SET_APPROVAL_STATUS";

/** Role gate: approved/rejected/activated are business workflows (SA/ADMIN). */
export function canRunWorkflow(actor: AdminActor): boolean {
  return WORKFLOW_ADMIN_ROLES.includes(actor.role);
}

/** True when a request may fire `action` from its current `status`. */
export function canTransitionRequest(status: string, action: RequestAction): boolean {
  return (REQUEST_TRANSITIONS[action] as readonly string[]).includes(status);
}

/** True when an application may fire `action` from its current `status`. */
export function canTransitionApplication(status: string, action: ApplicationAction): boolean {
  const allowed = APPLICATION_TRANSITIONS[action] as readonly string[] | undefined;
  return allowed !== undefined && allowed.includes(status);
}
