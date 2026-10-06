/**
 * Approve/Publish workflow (M3.3C3) — transition + RBAC contract, mirroring
 * the Admin → Athletes/Groups Approve action. Also covers the sponsor PAYMENT
 * lifecycle contract: public sponsorship creates start `INITIATED` (never
 * PAID), and the value flow belongs to the future server-side Razorpay seam.
 *
 * The UI sends `{ type: "approve-entity", kind, id, to: "approved" }` →
 * `useAdminWorkflow.run` → `setApprovalStatus` → transactional
 * `runWorkflowTransition` (audit entry + approvalStatus update atomically).
 * Only SUPER_ADMIN/ADMIN may run it (rules + `canRunWorkflow` agree; CM
 * cannot change approvalStatus). Sponsor-applications have NO approve action:
 * sponsors support athletes directly, no approval needed.
 */
import { describe, expect, it } from "vitest";
import {
  canRunWorkflow,
  canTransitionRequest,
  canTransitionApplication,
  REQUEST_TRANSITIONS,
  APPLICATION_TRANSITIONS,
  PAYMENT_STATUSES,
  WORKFLOW_ADMIN_ROLES,
  type ApplicationStatus,
  type ApprovalStatus,
  type PaymentStatus,
} from "@/features/admin/workflow";
import {
  FirestoreDataAdapter,
  mapAdminSponsorApplication,
  buildSponsorApplicationDoc,
} from "@/services/firestore-adapter";
import type { SponsorApplicationFormValues } from "@/features/sponsorship/schema";

describe("admin approve/publish workflow — RBAC", () => {
  it("only SUPER_ADMIN and ADMIN may run approval workflows", () => {
    expect(WORKFLOW_ADMIN_ROLES).toEqual(["SUPER_ADMIN", "ADMIN"]);
    expect(canRunWorkflow({ role: "SUPER_ADMIN" })).toBe(true);
    expect(canRunWorkflow({ role: "ADMIN" })).toBe(true);
    expect(canRunWorkflow({ role: "CONTENT_MANAGER" })).toBe(false);
  });

  it("approve target 'approved' is a valid ApprovalStatus used by rules/domain", () => {
    const statuses: readonly ApprovalStatus[] = ["draft", "pending", "approved", "rejected"];
    expect(statuses).toContain("approved");
  });

  it("firebase-disabled adapter returns firebase-disabled (never throws) for approve", async () => {
    const adapter = new FirestoreDataAdapter(null);
    const result = await adapter.setApprovalStatus("athletes", "doc-1", "approved", {
      role: "SUPER_ADMIN",
      uid: "uid-1",
    });
    expect(result).toEqual({ ok: false, reason: "firebase-disabled" });
  });

  it("request/application state machines are unchanged (locked transitions)", () => {
    expect(REQUEST_TRANSITIONS.approve).toEqual(["REVIEWING"]);
    expect(canTransitionRequest("REVIEWING", "approve")).toBe(true);
    expect(canTransitionRequest("PENDING", "approve")).toBe(false);
    expect(canTransitionApplication("PENDING", "review")).toBe(true);
    expect(canTransitionApplication("REJECTED", "reopen")).toBe(true);
  });
});

describe("sponsor payment lifecycle — no admin approval on sponsor applications (M3.3C extension)", () => {
  it("the sponsor-application state machine has NO approve action (direct sponsorship)", () => {
    expect(APPLICATION_TRANSITIONS.approve).toBeUndefined();
    expect(canTransitionApplication("REVIEWING", "approve")).toBe(false);
    expect(canTransitionApplication("PENDING", "review")).toBe(true);
    expect(canTransitionApplication("REVIEWING", "contact")).toBe(true);
    expect(canTransitionApplication("PENDING", "reject")).toBe(true);
  });

  it("PAYMENT_STATUSES locks the 4-value payment lifecycle (no invented states)", () => {
    expect(PAYMENT_STATUSES).toEqual(["INITIATED", "PAID", "FAILED", "REFUNDED"]);
  });

  it("APPROVED is not an application status anymore; payment is tracked via paymentStatus", () => {
    const statuses: readonly ApplicationStatus[] = [
      "PENDING",
      "REVIEWING",
      "CONTACTED",
      "CLOSED",
      "REJECTED",
    ];
    expect(statuses).not.toContain("APPROVED");
    const payments: readonly PaymentStatus[] = ["INITIATED", "PAID", "FAILED", "REFUNDED"];
    expect(payments).toContain("INITIATED");
  });

  it("firebase-disabled adapter returns firebase-disabled (never throws) for application transitions", async () => {
    const adapter = new FirestoreDataAdapter(null);
    const result = await adapter.transitionApplication(
      "doc-1",
      "reject",
      { role: "SUPER_ADMIN", uid: "uid-1" },
      { reason: "out of scope" },
    );
    expect(result).toEqual({ ok: false, reason: "firebase-disabled" });
  });

  it("buildSponsorApplicationDoc produces an INITIATED sponsorship (never PAID)", () => {
    const values: SponsorApplicationFormValues = {
      organizationName: "Acme Sports",
      contactName: "Jane Doe",
      email: "jane@example.com",
      phone: "+91 90000 00000",
      website: "",
      organizationType: "individual",
      sponsorshipLevel: "custom",
      amount: 25000,
      message: "Athlete: Idris (abc123). Title sponsor.",
      consentGiven: true,
      antiSpamToken: "nonce-abc",
    };
    const doc = buildSponsorApplicationDoc(values);
    expect(doc.paymentStatus).toBe("INITIATED");
    expect(doc.paymentStatus).not.toBe("PAID");
    expect(doc.paymentProvider).toBe("razorpay");
    expect(doc.currency).toBe("INR");
    expect(doc.amount).toBe(25000);
    expect(doc).not.toHaveProperty("paymentId");
    expect(doc).not.toHaveProperty("orderId");
    expect(doc).not.toHaveProperty("paymentCompletedAt");
    expect(doc.status).toBe("PENDING");
  });

  it("mapAdminSponsorApplication surfaces payment fields + athlete from the real doc", () => {
    const mapped = mapAdminSponsorApplication("app-1", {
      status: "PENDING",
      paymentStatus: "PAID",
      paymentProvider: "razorpay",
      currency: "INR",
      amount: 25000,
      paymentId: "pay_Xyz",
      orderId: "order_Abc",
      interestType: "individual",
      orgName: "Acme Sports",
      contactName: "Jane Doe",
      email: "jane@example.com",
      phone: null,
      website: null,
      supportKind: "custom",
      message: "Athlete: Idris (abc123). Title sponsor.",
      athleteRef: { id: "abc123", name: "Idris", sport: "Boxing" },
      createdAt: "2026-09-05T00:00:00.000Z",
    });
    expect(mapped.status).toBe("PENDING");
    expect(mapped.paymentStatus).toBe("PAID");
    expect(mapped.amount).toBe(25000);
    expect(mapped.currency).toBe("INR");
    expect(mapped.paymentProvider).toBe("razorpay");
    expect(mapped.paymentId).toBe("pay_Xyz");
    expect(mapped.orderId).toBe("order_Abc");
    expect(mapped.athlete).toEqual({ id: "abc123", name: "Idris", sport: "Boxing" });
    expect(mapped.contactName).toBe("Jane Doe");
  });

  it("mapAdminSponsorApplication defaults legacy docs to INITIATED and tolerates missing athleteRef", () => {
    const mapped = mapAdminSponsorApplication("app-2", {
      status: "PENDING",
      orgName: "Acme Sports",
      contactName: "Jane Doe",
      email: "jane@example.com",
    });
    expect(mapped.status).toBe("PENDING");
    expect(mapped.paymentStatus).toBe("INITIATED");
    expect(mapped.amount).toBeNull();
    expect(mapped.athlete).toBeNull();
  });
});