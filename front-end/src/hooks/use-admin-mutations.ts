/**
 * M3.3C2 — Admin catalogue mutation wiring.
 *
 * Single seam that connects the M3.3C1 FirestoreDataAdapter CRUD methods to
 * the admin UI. Everything goes through `runCatalogueMutation` (the pure
 * dispatcher) and the `useAdminMutation` hook:
 *
 *  - `runCatalogueMutation` resolves the typed adapter endpoint for a kind
 *    and forwards the operation, preserving the adapter's role/RBAC + Zod
 *    enforcement (Firestore rules remain the ultimate authority).
 *  - `useAdminMutation` derives the acting role from the live auth session
 *    (the same `users/{uid}` authority the rules read), runs the mutation,
 *    and invalidates the matching admin + public TanStack Query keys on
 *    success so list/detail views refresh.
 *
 * Firebase-disabled mode is handled by the adapter (returns
 * `{ reason: "firebase-disabled" }`); this module surfaces that result to the
 * UI without throwing.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFirestoreAdapter } from "@/services/firestore-adapter";
import type { AdminMutationResult } from "@/services/firestore-adapter";
import { useAuthSession } from "@/components/admin/admin-guard";
import type { AdminActor, AthleteWrite, EntityKind, EventWrite, GalleryImageWrite, GroupWrite, PartnerWrite, StoryWrite } from "@/features/admin/catalogue";

export type CatalogueAdminOp =
  | { type: "create"; data: Record<string, unknown> }
  | { type: "update"; id: string; data: Record<string, unknown> }
  | { type: "delete"; id: string };

/** Admin + public React-Query keys for a catalogue entity (mirrors use-firestore). */
export const CATALOGUE_QUERY_KEYS: Record<EntityKind, { admin: readonly string[]; public: readonly string[] }> = {
  athletes: { admin: ["admin", "athletes"], public: ["public", "athletes"] },
  groups: { admin: ["admin", "groups"], public: ["public", "groups"] },
  events: { admin: ["admin", "events"], public: ["public", "events"] },
  stories: { admin: ["admin", "stories"], public: ["public", "stories"] },
  galleryImages: { admin: ["admin", "gallery"], public: ["public", "gallery"] },
  partners: { admin: ["admin", "partners"], public: ["public", "partners"] },
};

let adapter: ReturnType<typeof createFirestoreAdapter> | null = null;

function dataAdapter() {
  if (!adapter) adapter = createFirestoreAdapter();
  return adapter;
}

/**
 * Pure dispatcher — call the typed adapter endpoint for `kind`.
 * Kept separate from the hook so it is directly unit-testable without React.
 */
export function runCatalogueMutation(
  kind: EntityKind,
  actor: AdminActor,
  op: CatalogueAdminOp,
): Promise<AdminMutationResult> {
  const a = dataAdapter();
  switch (kind) {
    case "athletes": {
      if (op.type === "create") return a.createAthlete(op.data as AthleteWrite, actor);
      if (op.type === "delete") return a.deleteAthlete(op.id, actor);
      return a.updateAthlete(op.id, op.data as AthleteWrite, actor);
    }
    case "groups": {
      if (op.type === "create") return a.createGroup(op.data as GroupWrite, actor);
      if (op.type === "delete") return a.deleteGroup(op.id, actor);
      return a.updateGroup(op.id, op.data as GroupWrite, actor);
    }
    case "events": {
      if (op.type === "create") return a.createEvent(op.data as EventWrite, actor);
      if (op.type === "delete") return a.deleteEvent(op.id, actor);
      return a.updateEvent(op.id, op.data as EventWrite, actor);
    }
    case "stories": {
      if (op.type === "create") return a.createStory(op.data as StoryWrite, actor);
      if (op.type === "delete") return a.deleteStory(op.id, actor);
      return a.updateStory(op.id, op.data as StoryWrite, actor);
    }
    case "galleryImages": {
      if (op.type === "create") return a.createGalleryImage(op.data as GalleryImageWrite, actor);
      if (op.type === "delete") return a.deleteGalleryImage(op.id, actor);
      return a.updateGalleryImage(op.id, op.data as GalleryImageWrite, actor);
    }
    case "partners": {
      if (op.type === "create") return a.createPartner(op.data as PartnerWrite, actor);
      if (op.type === "delete") return a.deletePartner(op.id, actor);
      return a.updatePartner(op.id, op.data as PartnerWrite, actor);
    }
  }
}

export interface AdminMutationHook {
  role: AdminActor["role"] | null;
  isAdmin: boolean;
  /** True when creates are allowed for this session (all active staff may create). */
  canCreate: boolean;
  /** CONTENT_MANAGER may not delete — SUPER_ADMIN/ADMIN only. */
  canDelete: boolean;
  isPending: boolean;
  lastResult: AdminMutationResult | null;
  create: (data: Record<string, unknown>) => Promise<AdminMutationResult>;
  update: (id: string, data: Record<string, unknown>) => Promise<AdminMutationResult>;
  remove: (id: string) => Promise<AdminMutationResult>;
}

const UNAUTHORIZED: AdminMutationResult = { ok: false, reason: "unauthorized" };

export interface AdminContentBlockMutationHook {
  role: AdminActor["role"] | null;
  isPending: boolean;
  lastResult: AdminMutationResult | null;
  save: (data: Record<string, string>) => Promise<AdminMutationResult>;
}

/**
 * Save writes to the public website-content seams (`contentBlocks/{id}`)
 * through the adapter. Any active staff role may edit content; the adapter +
 * Firestore rules keep the write authorized. Invalidates the matching public
 * content query so the live site reflects edits immediately.
 */
export function useAdminContentBlockMutation(id: string): AdminContentBlockMutationHook {
  const auth = useAuthSession();
  const queryClient = useQueryClient();
  const role = auth.status === "authorized" && auth.session ? auth.session.role : null;

  const mutation = useMutation<AdminMutationResult, unknown, Record<string, string>>({
    mutationFn: (data) => {
      if (!role) return Promise.resolve(UNAUTHORIZED);
      return dataAdapter().saveContentBlock(id, data, { role });
    },
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["public", "content", id] });
      }
    },
  });

  return {
    role,
    isPending: mutation.isPending,
    lastResult: mutation.data ?? null,
    save: (data) => mutation.mutateAsync(data),
  };
}

/**
 * React hook: run catalogue mutations against the adapter, using the role from
 * the live auth session and invalidating the relevant queries on success.
 */
export function useAdminMutation(kind: EntityKind): AdminMutationHook {
  const auth = useAuthSession();
  const queryClient = useQueryClient();
  const role = auth.status === "authorized" && auth.session ? auth.session.role : null;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const mutation = useMutation<AdminMutationResult, unknown, CatalogueAdminOp>({
    mutationFn: (op) => {
      if (!role) return Promise.resolve(UNAUTHORIZED);
      return runCatalogueMutation(kind, { role }, op);
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      const keys = CATALOGUE_QUERY_KEYS[kind];
      void queryClient.invalidateQueries({ queryKey: [...keys.admin] });
      void queryClient.invalidateQueries({ queryKey: [...keys.public] });
    },
  });

  return {
    role,
    isAdmin,
    canCreate: role !== null,
    canDelete: isAdmin,
    isPending: mutation.isPending,
    lastResult: mutation.data ?? null,
    create: (data) => mutation.mutateAsync({ type: "create", data }),
    update: (id, data) => mutation.mutateAsync({ type: "update", id, data }),
    remove: (id) => mutation.mutateAsync({ type: "delete", id }),
  };
}
