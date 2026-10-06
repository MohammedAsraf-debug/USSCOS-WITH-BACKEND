/**
 * React-Query data hooks for the Firestore adapter.
 *
 * Every hook reads through `services/firestore-adapter.ts` (never Firebase
 * directly). When Firebase is disabled the adapter returns safe empty
 * results, so these hooks resolve immediately to empty/loading-free states â€”
 * no credentials required in CI/tests.
 */
import { useQuery } from "@tanstack/react-query";
import { createFirestoreAdapter } from "@/services/firestore-adapter";
import type {
  AdminAthlete,
  AdminEvent,
  AdminGalleryImage,
  AdminGroup,
  AdminPartner,
  AdminPaymentRecord,
  AdminSponsorApplication,
  AdminStory,
  InboxItem,
} from "@/domain";

let adapter: ReturnType<typeof createFirestoreAdapter> | null = null;

function dataAdapter() {
  if (!adapter) adapter = createFirestoreAdapter();
  return adapter;
}

async function logQueryError<T>(tag: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[use-firestore] ${tag} query failed`, err);
    throw err;
  }
}

const QUERIES = {
  publicAthletes: ["public", "athletes"],
  publicAthlete: (id: string) => ["public", "athletes", id],
  publicGroups: ["public", "groups"],
  publicGroup: (id: string) => ["public", "groups", id],
  publicEvents: ["public", "events"],
  publicEvent: (id: string) => ["public", "events", id],
  publicStories: ["public", "stories"],
  publicStory: (id: string) => ["public", "stories", id],
  publicGallery: ["public", "gallery"],
  publicPartners: ["public", "partners"],
  publicOpportunities: ["public", "opportunities"],
  publicSportDisciplines: ["public", "sport-disciplines"],
  publicContentBlock: (id: string) => ["public", "content", id],
  adminAthletes: ["admin", "athletes"],
  adminGroups: ["admin", "groups"],
  adminEvents: ["admin", "events"],
  adminStories: ["admin", "stories"],
  adminGallery: ["admin", "gallery"],
  adminPartners: ["admin", "partners"],
  adminSponsorApplications: ["admin", "sponsor-applications"],
  adminSponsorApplication: (id: string) => ["admin", "sponsor-applications", id],
  adminSponsorshipRequests: ["admin", "sponsorship-requests"],
  adminSponsorshipRequest: (id: string) => ["admin", "sponsorship-requests", id],
  adminPaymentRecords: ["admin", "payment-records"],
  inbox: ["admin", "inbox"],
} as const;

// ----- Public reads -----

export function usePublicAthletes() {
  return useQuery({
    queryKey: QUERIES.publicAthletes,
    queryFn: () => dataAdapter().listPublicAthletes(),
    select: (page) => page.items,
  });
}

export function usePublicAthlete(id: string) {
  return useQuery({
    queryKey: QUERIES.publicAthlete(id),
    queryFn: () => dataAdapter().getPublicAthlete(id),
    enabled: Boolean(id),
  });
}

export function usePublicGroups() {
  return useQuery({
    queryKey: QUERIES.publicGroups,
    queryFn: () => dataAdapter().listPublicGroups(),
    select: (page) => page.items,
  });
}

export function usePublicGroup(id: string) {
  return useQuery({
    queryKey: QUERIES.publicGroup(id),
    queryFn: () => dataAdapter().getPublicGroup(id),
    enabled: Boolean(id),
  });
}

export function usePublicEvents() {
  return useQuery({
    queryKey: QUERIES.publicEvents,
    queryFn: () => dataAdapter().listPublicEvents(),
    select: (page) => page.items,
  });
}

export function usePublicEvent(id: string) {
  return useQuery({
    queryKey: QUERIES.publicEvent(id),
    queryFn: () => dataAdapter().getPublicEvent(id),
    enabled: Boolean(id),
  });
}

export function usePublicStories() {
  return useQuery({
    queryKey: QUERIES.publicStories,
    queryFn: () => dataAdapter().listPublicStories(),
    select: (page) => page.items,
  });
}

export function usePublicStory(id: string) {
  return useQuery({
    queryKey: QUERIES.publicStory(id),
    queryFn: () => dataAdapter().getPublicStory(id),
    enabled: Boolean(id),
  });
}

export function usePublicGallery() {
  return useQuery({
    queryKey: QUERIES.publicGallery,
    queryFn: () => dataAdapter().listPublicGallery(),
    select: (page) => page.items,
  });
}

export function usePublicPartners() {
  return useQuery({
    queryKey: QUERIES.publicPartners,
    queryFn: () => dataAdapter().listPublicPartners(),
    select: (page) => page.items,
  });
}

export function usePublicOpportunities() {
  return useQuery({
    queryKey: QUERIES.publicOpportunities,
    queryFn: () => dataAdapter().listPublicOpportunities(),
    select: (page) => page.items,
  });
}

export function usePublicSportDisciplines() {
  return useQuery({
    queryKey: QUERIES.publicSportDisciplines,
    queryFn: () => dataAdapter().listPublicSportDisciplines(),
  });
}

/** Public website content block (string map); null when none stored yet. */
export function useContentBlock(id: string) {
  return useQuery({
    queryKey: QUERIES.publicContentBlock(id),
    queryFn: () => dataAdapter().getContentBlock(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

// ----- Admin reads -----

export function useAdminAthletes() {
  return useQuery({
    queryKey: QUERIES.adminAthletes,
    queryFn: () => logQueryError("admin athletes", () => dataAdapter().listAdminAthletes()),
    select: (page: { items: AdminAthlete[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminGroups() {
  return useQuery({
    queryKey: QUERIES.adminGroups,
    queryFn: () => logQueryError("admin groups", () => dataAdapter().listAdminGroups()),
    select: (page: { items: AdminGroup[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminEvents() {
  return useQuery({
    queryKey: QUERIES.adminEvents,
    queryFn: () => logQueryError("admin events", () => dataAdapter().listAdminEvents()),
    select: (page: { items: AdminEvent[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminStories() {
  return useQuery({
    queryKey: QUERIES.adminStories,
    queryFn: () => logQueryError("admin stories", () => dataAdapter().listAdminStories()),
    select: (page: { items: AdminStory[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminGallery() {
  return useQuery({
    queryKey: QUERIES.adminGallery,
    queryFn: () => logQueryError("admin gallery", () => dataAdapter().listAdminGallery()),
    select: (page: { items: AdminGalleryImage[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminPartners() {
  return useQuery({
    queryKey: QUERIES.adminPartners,
    queryFn: () => logQueryError("admin partners", () => dataAdapter().listAdminPartners()),
    select: (page: { items: AdminPartner[]; nextCursor?: string }) => page.items,
  });
}

export function useInbox() {
  return useQuery({
    queryKey: QUERIES.inbox,
    queryFn: () => dataAdapter().listInbox(),
    select: (page: { items: InboxItem[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminSponsorApplications() {
  return useQuery({
    queryKey: QUERIES.adminSponsorApplications,
    queryFn: () => dataAdapter().listAdminSponsorApplications(),
    select: (page: { items: AdminSponsorApplication[]; nextCursor?: string }) => page.items,
  });
}

export function useAdminSponsorshipRequest(id: string) {
  return useQuery({
    queryKey: QUERIES.adminSponsorshipRequest(id),
    queryFn: () => dataAdapter().getAdminSponsorshipRequest(id),
    enabled: Boolean(id),
  });
}

export function useAdminSponsorApplication(id: string) {
  return useQuery({
    queryKey: QUERIES.adminSponsorApplication(id),
    queryFn: () => dataAdapter().getAdminSponsorApplication(id),
    enabled: Boolean(id),
  });
}


export function useAdminPaymentRecords() {
  return useQuery({
    queryKey: QUERIES.adminPaymentRecords,
    queryFn: () => logQueryError("admin payment records", () => dataAdapter().listPaymentRecords()),
    select: (page: { items: AdminPaymentRecord[]; nextCursor?: string }) => page.items,
  });
}
