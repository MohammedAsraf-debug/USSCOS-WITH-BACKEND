/**
 * M3.3C3 — Admin workflow + audit wiring.
 *
 * Connects the FirestoreDataAdapter workflow-transition methods to the admin
 * UI, mirroring the M3.3C2 `useAdminMutation` seam:
 *
 *  - `runWorkflowAction` resolves the typed adapter endpoint (approval,
 *    story publish, partner activation, sponsorship request/application
 *    transitions) and forwards the operation, preserving the adapter's
 *    transaction + RBAC + audit enforcement (Firestore rules remain the
 *    ultimate authority and the commit is atomic).
 *  - `useAdminWorkflow` derives the acting staff identity (`role`, `uid`,
 *    `email`) from the live auth session — the same `users/{uid}` authority
 *    the rules read — runs the transition, and invalidates the catalogue,
 *    public, and audit query keys on success so dependent views refresh.
 *
 * Firebase-disabled mode is handled by the adapter (returns
 * `{ reason: "firebase-disabled" }`); this module surfaces that result to the
 * UI without throwing.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFirestoreAdapter } from "@/services/firestore-adapter";
import type { WorkflowResult } from "@/services/firestore-adapter";
import { useAuthSession } from "@/components/admin/admin-guard";
import { CATALOGUE_QUERY_KEYS } from "@/hooks/use-admin-mutations";
import type { ApprovalStatus } from "@/features/admin/workflow";
import type {
  ApplicationAction,
  RequestAction,
  WorkflowActor,
} from "@/features/admin/workflow";

export type WorkflowOp =
  | { type: "approve-entity"; kind: "athletes" | "groups"; id: string; to: ApprovalStatus; note?: string }
  | { type: "publish-story"; id: string; published: boolean }
  | { type: "partner-active"; id: string; active: boolean }
  | { type: "request-transition"; id: string; action: RequestAction; reason?: string }
  | { type: "application-transition"; id: string; action: ApplicationAction; reason?: string };

/** Audit + all catalogue (admin/public) + sponsorship-admin query keys to invalidate after a transition. */
export const WORKFLOW_QUERY_KEYS: {
  catalogueAdmin: readonly string[];
  cataloguePublic: readonly string[];
  audit: readonly string[];
  sponsorshipAdmin: readonly (readonly string[])[];
} = {
  catalogueAdmin: CATALOGUE_QUERY_KEYS.athletes.admin.map((k) => k),
  cataloguePublic: CATALOGUE_QUERY_KEYS.athletes.public.map((k) => k),
  audit: ["admin", "auditLogs"],
  sponsorshipAdmin: [
    ["admin", "sponsor-applications"],
    ["admin", "inbox"],
  ],
};

let adapter: ReturnType<typeof createFirestoreAdapter> | null = null;

function dataAdapter() {
  if (!adapter) adapter = createFirestoreAdapter();
  return adapter;
}

/** Pure dispatcher — call the typed adapter workflow endpoint for `op`. */
export function runWorkflowAction(actor: WorkflowActor, op: WorkflowOp): Promise<WorkflowResult> {
  const a = dataAdapter();
  switch (op.type) {
    case "approve-entity":
      return a.setApprovalStatus(op.kind, op.id, op.to, actor, op.note);
    case "publish-story":
      return a.setStoryPublished(op.id, op.published, actor);
    case "partner-active":
      return a.setPartnerActive(op.id, op.active, actor);
    case "request-transition":
      return a.transitionRequest(op.id, op.action, actor, { reason: op.reason });
    case "application-transition":
      return a.transitionApplication(op.id, op.action, actor, { reason: op.reason });
  }
}

const UNAUTHORIZED: WorkflowResult = { ok: false, reason: "unauthorized" };

export interface AdminWorkflowHook {
  actor: WorkflowActor | null;
  isAdmin: boolean;
  isPending: boolean;
  lastResult: WorkflowResult | null;
  run: (op: WorkflowOp) => Promise<WorkflowResult>;
}

/**
 * React hook: run a workflow transition against the adapter using the live
 * acting identity, and invalidate dependent queries on success.
 */
export function useAdminWorkflow(): AdminWorkflowHook {
  const auth = useAuthSession();
  const queryClient = useQueryClient();
  const session = auth.status === "authorized" ? auth.session : null;
  const actor: WorkflowActor | null = session
    ? { role: session.role, uid: session.uid, email: session.email }
    : null;
  const isAdmin = actor?.role === "SUPER_ADMIN" || actor?.role === "ADMIN";

  const mutation = useMutation<WorkflowResult, unknown, WorkflowOp>({
    mutationFn: (op) => {
      if (!actor) return Promise.resolve(UNAUTHORIZED);
      return runWorkflowAction(actor, op);
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      for (const key of WORKFLOW_QUERY_KEYS.catalogueAdmin) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      for (const key of WORKFLOW_QUERY_KEYS.cataloguePublic) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      for (const key of WORKFLOW_QUERY_KEYS.sponsorshipAdmin) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.audit });
    },
  });

  return {
    actor,
    isAdmin,
    isPending: mutation.isPending,
    lastResult: mutation.data ?? null,
    run: (op) => mutation.mutateAsync(op),
  };
}
