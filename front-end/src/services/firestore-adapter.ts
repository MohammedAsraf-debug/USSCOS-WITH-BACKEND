/**
 * FIRESTORE ADAPTER — the single data-access seam.
 *
 * Features never import `firebase` directly (PROJECT_STRUCTURE §6); they
 * program against this adapter. It provides typed, mapped, visibility-safe
 * reads for the Phase 4 data model. Public reads are filtered at the query
 * level to the documented publication fields AND the mappers strip
 * PRIVATE / ADMIN-ONLY fields, so nothing leaks even if a control bypassed
 * the query layer.
 *
 * When Firebase is disabled (`firebaseEnabled === false`) every read returns
 * an empty result / null — safe in CI/training with no credentials.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase/firestore";
import { ensureInitialized, firebaseEnabled, getFirestoreInstance } from "@/services/firebase";
import type { PublicVisibility, UserRole } from "@/types";
import type {
  AdminAthlete,
  AdminEvent,
  AdminGalleryImage,
  AdminGroup,
  AdminPartner,
  AdminPaymentRecord,
  AdminSponsorApplication,
  AdminSponsorshipDocumentMetadata,
  AdminSponsorshipRequest,
  AdminStory,
  Athlete,
  Event,
  GalleryImage,
  Group,
  InboxItem,
  Opportunity,
  Partner,
  SportDiscipline,
  Story,
} from "@/domain";
import {
  requestSponsorshipSchema,
  sponsorApplicationSchema,
  type RequestSponsorshipFormValues,
  type SponsorApplicationFormValues,
} from "@/features/sponsorship/schema";
import { contactMessageSchema, type ContactMessageFormValues } from "@/features/contact/schema";
import { donationPledgeSchema, type DonationPledgeFormValues } from "@/features/donation/schema";
import {
  CATALOGUE_COLLECTIONS,
  CATALOGUE_SCHEMAS,
  CM_FORBIDDEN_FIELDS,
  CM_UPDATE_ALLOWLIST,
  CREATE_DEFAULTS,
  contentBlockWriteSchema,
  omitUndefinedValues,
  type AdminActor,
  type AthleteWrite,
  type EntityKind,
  type EventWrite,
  type GalleryImageWrite,
  type GroupWrite,
  type PartnerWrite,
  type StoryWrite,
} from "@/features/admin/catalogue";
import {
  canTransitionApplication,
  canTransitionRequest,
  canRunWorkflow,
  PAYMENT_STATUSES,
  type ApplicationAction,
  type ApplicationStatus,
  type ApprovalStatus,
  type RequestAction,
  type RequestStatus,
  type WorkflowActor,
} from "@/features/admin/workflow";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CursorPage<T> {
  items: T[];
  /** Stable cursor for the next page; undefined when no more results. */
  nextCursor: string | undefined;
}

export function isPublic(visibility: PublicVisibility): boolean {
  return visibility === "PUBLISHED";
}

// ---------------------------------------------------------------------------
// Public submission writes (M3.3B)
// ---------------------------------------------------------------------------

/** Result of a public form submission write. Discriminated union. */
export type SubmissionResult =
  | { ok: true; id: string; duplicate?: boolean }
  | {
      ok: false;
      reason: "firebase-disabled" | "invalid" | "duplicate" | "error";
      message?: string;
    };

/** Fields the write rules reject on public create — never written by forms. */
const PUBLIC_WRITE_FORBIDDEN_FIELDS = [
  "adminNotes",
  "reviewHistory",
  "processedBy",
  // Server-assigned payment fields (Razorpay seam): never settable by the browser.
  "paymentId",
  "orderId",
  "paymentCompletedAt",
] as const;

/**
 * Client-generated idempotency nonce (FORM_ARCHITECTURE.md §7). Unique per
 * form instance; reused across retries of the same submission so an accidental
 * retry after a network-uncertain write does not double-create.
 */
export function createFormNonce(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * formNonces this client has already written successfully. Firestore reports
 * a same-nonce rewrite (genuine retry of a confirmed submission) and EVERY
 * other create-denial with the identical `permission-denied` code, so the
 * code alone can never prove a duplicate. This set is the only proof
 * available without an anonymous read (which the rules forbid): a denial for
 * a nonce in this set is honestly a duplicate; anything else must surface
 * the real denial. Bounded so a long session cannot grow it without limit.
 */
const confirmedSubmissionNonces = new Set<string>();

function markSubmissionConfirmed(nonce: string): void {
  if (confirmedSubmissionNonces.size >= 500) {
    const oldest = confirmedSubmissionNonces.values().next().value;
    if (oldest !== undefined) confirmedSubmissionNonces.delete(oldest);
  }
  confirmedSubmissionNonces.add(nonce);
}

function wasSubmissionConfirmed(nonce: string): boolean {
  return confirmedSubmissionNonces.has(nonce);
}

/** Strip any field the public-create rules forbid (defence in depth). */
function stripForbiddenWriteFields(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(PUBLIC_WRITE_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Recursively delete every key whose value is `undefined`, at every nesting
 * level. Firestore rejects an `undefined` field value at any depth with
 * "Unsupported field value: undefined", and the public sponsorship wizards
 * legitimately map empty optional inputs to `undefined` both at the top level
 * and inside nested structures (`documents[].documentType`, `socialMedia.*`)
 * (see Apply.jsx / AcademyApplication.jsx `|| undefined` guards). Unlike the
 * event-write strip (which is top-level-only), this seam must descend so a
 * single `undefined` deep inside a submitted doc can never reach `addDoc`.
 *
 * Values that are meaningful to preserve — `null`, `""`, `0`, `false` — are
 * kept untouched. This is the exact guarantee the python contract wants: every
 * optional field either holds a real value or is absent from the written doc
 * (never written as `undefined`).
 */
export function stripUndefinedValuesDeep(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(value)) {
      const nested = stripUndefinedValuesDeep(value as Record<string, unknown>);
      out[key] = nested;
    } else if (Array.isArray(value)) {
      out[key] = value
        .map((item) =>
          isPlainObject(item) ? stripUndefinedValuesDeep(item as Record<string, unknown>) : item,
        )
        .filter((item) => item !== undefined);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Admin catalogue mutations (M3.3C1)
// ---------------------------------------------------------------------------

/** Fields only readable as the canonical identity of the table name. */
export type AdminMutationResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason:
        | "firebase-disabled"
        | "unauthorized"
        | "invalid"
        | "forbidden-field"
        | "not-found"
        | "error";
      message?: string;
    };

const VALID_ADMIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"];

function isStaffRole(role: unknown): role is AdminActor["role"] {
  return typeof role === "string" && (VALID_ADMIN_ROLES as readonly string[]).includes(role);
}

function isAdminRole(role: AdminActor["role"]): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// ---------------------------------------------------------------------------
// Admin workflow transitions + audit trail (M3.3C3)
// ---------------------------------------------------------------------------

/** Result of a workflow transition write. Discriminated union. */
export type WorkflowResult =
  | { ok: true; id: string; action: string; auditId?: string; from?: string | null; to?: string }
  | {
      ok: false;
      reason: "firebase-disabled" | "unauthorized" | "not-found" | "invalid-transition" | "error";
      message?: string;
    };

/** Build an immutable auditLogs document (field names per FIRESTORE_DATA_MODEL §2.16). */
function buildAuditEntry(params: {
  entityKind: string;
  entityId: string;
  action: string;
  actor: WorkflowActor;
  before: unknown;
  after: unknown;
  note?: string | null;
}): Record<string, unknown> {
  return {
    entityKind: params.entityKind,
    entityId: params.entityId,
    action: params.action,
    byUid: params.actor.uid,
    byEmail: params.actor.email ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    note: params.note ?? null,
    createdAt: new Date().toISOString(),
  };
}

/** Error carrying a discriminated workflow reason for clean result mapping. */
class WorkflowError extends Error {
  constructor(public reason: "not-found" | "invalid-transition", message?: string) {
    super(message ?? reason);
    this.name = "WorkflowError";
  }
}

function mapWorkflowError(err: unknown): WorkflowResult {
  if (err instanceof WorkflowError) {
    return { ok: false, reason: err.reason, message: err.message };
  }
  return {
    ok: false,
    reason: "error",
    message: err instanceof Error ? err.message : "Workflow transition failed",
  };
}


// ---------------------------------------------------------------------------
// Field constants (mirror FIRESTORE_DATA_MODEL.md)
// ---------------------------------------------------------------------------

const APPROVED = "approved";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Mapping helpers (pure, unit-testable)
// ---------------------------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumber(value: unknown): number | null | undefined {
  return typeof value === "number" ? value : undefined;
}

export function mapMoneyNeed(raw: unknown): { kind: string; amount?: string | null; note?: string | null } {
  if (!raw || typeof raw !== "object") return { kind: "" };
  const r = raw as Record<string, unknown>;
  return {
    kind: asString(r.kind) ?? "",
    amount: asString(r.amount) ?? null,
    note: asString(r.note) ?? null,
  };
}

export function mapAthlete(id: string, raw: DocumentData): Athlete {
  return {
    id,
    slug: asString(raw.slug) ?? id,
    fullName: asString(raw.fullName) ?? "",
    sport: asString(raw.sport) ?? "",
    level: asString(raw.level) ?? null,
    record: asString(raw.record) ?? null,
    championships: asNumber(raw.championships),
    medals: asNumber(raw.medals),
    biography: asString(raw.biography) ?? null,
    tagline: asString(raw.tagline) ?? null,
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    competitionHistory: Array.isArray(raw.competitionHistory) ? raw.competitionHistory : [],
    sponsorshipNeeds: Array.isArray(raw.sponsorshipNeeds)
      ? raw.sponsorshipNeeds.map(mapMoneyNeed)
      : [],
    sponsorshipPurpose: asString(raw.sponsorshipPurpose) ?? null,
    profileImageUrl: asString(raw.profileImageUrl) ?? null,
    coverImageUrl: asString(raw.coverImageUrl) ?? null,
    images: Array.isArray(raw.images) ? raw.images : [],
    socialLinks: raw.socialLinks && typeof raw.socialLinks === "object" ? raw.socialLinks : null,
    seoTitle: asString(raw.seoTitle) ?? null,
    seoDescription: asString(raw.seoDescription) ?? null,
  };
}

export function mapAdminAthlete(id: string, raw: DocumentData): AdminAthlete {
  const approval = raw.approvalStatus as AdminAthlete["approvalStatus"];
  return {
    ...mapAthlete(id, raw),
    approvalStatus: ["draft", "pending", "approved", "rejected"].includes(approval)
      ? approval
      : "draft",
    featured: Boolean(raw.featured),
    order: asNumber(raw.order) ?? undefined,
    updatedAt: toIso(raw.updatedAt),
  };
}

export function mapGroup(id: string, raw: DocumentData): Group {
  const gtype = raw.groupType as Group["groupType"];
  return {
    id,
    slug: asString(raw.slug) ?? id,
    groupName: asString(raw.groupName) ?? "",
    groupType: ["team", "club", "academy", "association"].includes(gtype) ? gtype : "club",
    location: asString(raw.location) ?? null,
    memberCount: asNumber(raw.memberCount),
    sports: asStringArray(raw.sports),
    description: asString(raw.description) ?? null,
    website: asString(raw.website) ?? null,
    images: Array.isArray(raw.images) ? raw.images : [],
    sponsorshipNeeds: Array.isArray(raw.sponsorshipNeeds)
      ? raw.sponsorshipNeeds.map(mapMoneyNeed)
      : [],
    sponsorshipPurpose: asString(raw.sponsorshipPurpose) ?? null,
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    seoTitle: asString(raw.seoTitle) ?? null,
    seoDescription: asString(raw.seoDescription) ?? null,
  };
}

export function mapAdminGroup(id: string, raw: DocumentData): AdminGroup {
  const approval = raw.approvalStatus as AdminGroup["approvalStatus"];
  return {
    ...mapGroup(id, raw),
    approvalStatus: ["draft", "pending", "approved", "rejected"].includes(approval)
      ? approval
      : "draft",
    featured: Boolean(raw.featured),
    order: asNumber(raw.order) ?? undefined,
    updatedAt: toIso(raw.updatedAt),
  };
}

export function mapEvent(id: string, raw: DocumentData): Event {
  const type = raw.type as Event["type"];
  const status = raw.status as Event["status"];
  return {
    id,
    slug: asString(raw.slug) ?? id,
    title: asString(raw.title) ?? "",
    type: ["informational", "athlete_or_group_involving", "sponsorship_opportunity"].includes(type)
      ? type
      : "informational",
    status: ["upcoming", "past", "draft"].includes(status) ? status : "draft",
    date: toIso(raw.date) ?? "",
    time: asString(raw.time) ?? null,
    endTime: asString(raw.endTime) ?? null,
    location: asString(raw.location) ?? null,
    description: asString(raw.description) ?? null,
    coverImageUrl: asString(raw.coverImageUrl) ?? null,
    registrationUrl: asString(raw.registrationUrl) ?? null,
    registrationNote: asString(raw.registrationNote) ?? null,
    participantIds: asStringArray(raw.participantIds),
    seoTitle: asString(raw.seoTitle) ?? null,
    seoDescription: asString(raw.seoDescription) ?? null,
  };
}

export function mapAdminEvent(id: string, raw: DocumentData): AdminEvent {
  return { ...mapEvent(id, raw), featured: Boolean(raw.featured), order: asNumber(raw.order) ?? undefined, updatedAt: toIso(raw.updatedAt) };
}

export function mapStory(id: string, raw: DocumentData): Story {
  return {
    id,
    slug: asString(raw.slug) ?? id,
    title: asString(raw.title) ?? "",
    excerpt: asString(raw.excerpt) ?? null,
    body: asString(raw.body) ?? null,
    coverImageUrl: asString(raw.coverImageUrl) ?? null,
    tags: asStringArray(raw.tags),
    author: asString(raw.author) ?? null,
    published: Boolean(raw.published),
    publishedAt: toIso(raw.publishedAt),
  };
}

export function mapAdminStory(id: string, raw: DocumentData): AdminStory {
  return { ...mapStory(id, raw), updatedAt: toIso(raw.updatedAt) };
}

export function mapGalleryImage(id: string, raw: DocumentData): GalleryImage {
  return {
    id,
    title: asString(raw.title) ?? null,
    altText: asString(raw.altText) ?? "",
    category: asString(raw.category) ?? "",
    eventId: asString(raw.eventId) ?? null,
    publicUrl: asString(raw.publicUrl) ?? null,
    width: asNumber(raw.width),
    height: asNumber(raw.height),
  };
}

export function mapAdminGalleryImage(id: string, raw: DocumentData): AdminGalleryImage {
  return { ...mapGalleryImage(id, raw), order: asNumber(raw.order) ?? undefined };
}

export function mapPartner(id: string, raw: DocumentData): Partner {
  const type = raw.type as Partner["type"];
  return {
    id,
    name: asString(raw.name) ?? "",
    logoUrl: asString(raw.logoUrl) ?? null,
    website: asString(raw.website) ?? null,
    type: ["sponsor", "academy-group", "media"].includes(type) ? type : "sponsor",
    category: asString(raw.category) ?? null,
    active: Boolean(raw.active),
  };
}

export function mapAdminPartner(id: string, raw: DocumentData): AdminPartner {
  return {
    ...mapPartner(id, raw),
    featured: Boolean(raw.featured),
    order: asNumber(raw.order) ?? undefined,
  };
}

export function mapOpportunity(id: string, raw: DocumentData): Opportunity {
  const type = raw.type as Opportunity["type"];
  const status = raw.status as Opportunity["status"];
  return {
    id,
    slug: asString(raw.slug) ?? id,
    title: asString(raw.title) ?? "",
    type: ["athlete", "group", "event", "general"].includes(type) ? type : "general",
    status: ["open", "closed", "on_hold"].includes(status) ? status : "closed",
    description: asString(raw.description) ?? null,
    needs: Array.isArray(raw.needs) ? raw.needs.map(mapMoneyNeed) : [],
    closesAt: toIso(raw.closesAt),
    primaryRef:
      raw.primaryRef && typeof raw.primaryRef === "object" ? raw.primaryRef : null,
  };
}

export function mapSportDiscipline(id: string, raw: DocumentData): SportDiscipline {
  return { id, name: asString(raw.name) ?? "", active: Boolean(raw.active) };
}

const APPLICATION_STATUSES: readonly string[] = [
  "PENDING",
  "REVIEWING",
  "CONTACTED",
  "CLOSED",
  "REJECTED",
];

/** Admin read shape for the real `sponsorApplications` sponsorship/payment doc. */


export function mapAdminSponsorApplication(
  id: string,
  raw: Record<string, unknown>,
): AdminSponsorApplication {
  const status = String(raw.status ?? "PENDING");
  const paymentStatus = String(raw.paymentStatus ?? "INITIATED");
  const athleteRaw =
    raw.athleteRef && typeof raw.athleteRef === "object"
      ? (raw.athleteRef as Record<string, unknown>)
      : null;
  return {
    id,
    status: (APPLICATION_STATUSES as readonly string[]).includes(status)
      ? (status as AdminSponsorApplication["status"])
      : "PENDING",
    paymentStatus: (PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
      ? (paymentStatus as AdminSponsorApplication["paymentStatus"])
      : "INITIATED",
    interestType: asString(raw.interestType) ?? "",
    orgName: asString(raw.orgName) ?? null,
    contactName: asString(raw.contactName) ?? "",
    email: asString(raw.email) ?? "",
    phone: asString(raw.phone) ?? null,
    website: asString(raw.website) ?? null,
    supportKind: asString(raw.supportKind) ?? null,
    message: asString(raw.message) ?? null,
    amount: asNumber(raw.amount) ?? null,
    currency: asString(raw.currency) ?? "INR",
    paymentProvider: asString(raw.paymentProvider) ?? null,
    paymentId: asString(raw.paymentId) ?? null,
    orderId: asString(raw.orderId) ?? null,
    athlete: athleteRaw
      ? {
          id: asString(athleteRaw.id) ?? undefined,
          name: asString(athleteRaw.name) ?? undefined,
          sport: asString(athleteRaw.sport) ?? undefined,
        }
      : null,
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
    assignedTo: asString(raw.assignedTo) ?? null,
    processedBy: asString(raw.processedBy) ?? null,
    rejectionReason: asString(raw.reason) ?? null,
    reviewHistory: Array.isArray(raw.reviewHistory) ? raw.reviewHistory : [],
  };
}

/** Supporting-document metadata per the flat `sponsorshipRequests` doc. Never
 * exposes file bytes or a public URL — `storageRef`/`fileUrl` are only carried
 * so the admin UI can render the "secure access not configured" state. */
function mapSponsorshipDocumentMetadata(raw: unknown): AdminSponsorshipDocumentMetadata {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    documentCategory: asString(d.documentCategory) ?? null,
    documentType: asString(d.documentType) ?? null,
    fileName: asString(d.fileName) ?? null,
    fileSizeBytes: asNumber(d.fileSizeBytes) ?? null,
    fileType: asString(d.fileType) ?? null,
    storageRef: asString(d.storageRef) ?? null,
    fileUrl: asString(d.fileUrl) ?? null,
    status: asString(d.status) ?? null,
    uploadedAt: toIso(d.uploadedAt) ?? null,
    verificationStatus: asString(d.verificationStatus) ?? null,
  };
}

function mapSocialMediaRecord(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const s = asString(value);
    if (s) out[key] = s;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Admin read shape for the flat `sponsorshipRequests` doc — the full persisted
 * application record, discriminated by `type`. Newest/worker-safe: maps only
 * persisted public-applicant fields (never a public file URL; documents carry
 * metadata only).
 */
export function mapAdminSponsorshipRequest(id: string, raw: DocumentData): AdminSponsorshipRequest {
  const spine = {
    id,
    status: asString(raw.status) ?? "PENDING",
    consentGiven: raw.consentGiven === true,
    antiSpamToken: asString(raw.antiSpamToken) ?? null,
    contactPerson: asString(raw.contactPerson) ?? null,
    email: asString(raw.email) ?? null,
    phone: asString(raw.phone) ?? null,
    organization: asString(raw.organization) ?? null,
    sport: asString(raw.sport) ?? null,
    level: asString(raw.level) ?? null,
    location: asString(raw.location) ?? null,
    story: asString(raw.story) ?? null,
    sponsorshipNeeds: asString(raw.sponsorshipNeeds) ?? null,
    formNonce: asString(raw.formNonce) ?? null,
    socialMedia: mapSocialMediaRecord(raw.socialMedia),
    documents: Array.isArray(raw.documents) ? raw.documents.map(mapSponsorshipDocumentMetadata) : [],
    createdAt: toIso(raw.createdAt) ?? null,
    updatedAt: toIso(raw.updatedAt) ?? null,
  };
  if (raw.type === "group") {
    return {
      ...spine,
      type: "group",
      groupName: asString(raw.groupName) ?? null,
      memberCount: asNumber(raw.memberCount) ?? null,
      establishedYear: asNumber(raw.establishedYear) ?? null,
      contactRole: asString(raw.contactRole) ?? null,
      coachCount: asNumber(raw.coachCount) ?? null,
      coaches: asString(raw.coaches) ?? null,
      competitions: asString(raw.competitions) ?? null,
      website: asString(raw.website) ?? null,
      amountRequested: asNumber(raw.amountRequested) ?? null,
    };
  }
  return {
    ...spine,
    type: "athlete",
    fullName: asString(raw.fullName) ?? null,
    dateOfBirth: asString(raw.dateOfBirth) ?? null,
    currentRanking: asString(raw.currentRanking) ?? null,
    coach: asString(raw.coach) ?? null,
    academy: asString(raw.academy) ?? null,
    majorAchievements: asString(raw.majorAchievements) ?? null,
    upcomingCompetitions: asString(raw.upcomingCompetitions) ?? null,
    amountRequested: asNumber(raw.amountRequested) ?? null,
  };
}

/**
 * Admin read shape for the universal server-owned `paymentRecords` ledger.
 * Every field is defensive: unknown statuses fall back to INITIATED and maps
 * are coerced, so a hand-edited/server-side doc never breaks the admin UI.
 */
export function mapPaymentRecord(id: string, raw: DocumentData): AdminPaymentRecord {
  const paymentStatus = String(raw.paymentStatus ?? "INITIATED");
  const purpose = String(raw.purpose ?? "OTHER");
  const customerRaw =
    raw.customer && typeof raw.customer === "object"
      ? (raw.customer as Record<string, unknown>)
      : null;
  const entityRaw =
    raw.entity && typeof raw.entity === "object"
      ? (raw.entity as Record<string, unknown>)
      : null;
  const refundRaw =
    raw.refund && typeof raw.refund === "object"
      ? (raw.refund as Record<string, unknown>)
      : null;
  const currencies: readonly string[] = ["INR"];
  const isCurrency = (value: unknown): value is string =>
    typeof value === "string" && currencies.includes(value);

  return {
    id,
    purpose: (["SPONSORSHIP", "DONATION", "EVENT", "PROGRAM", "OTHER"] as const).includes(
      purpose as AdminPaymentRecord["purpose"],
    )
      ? (purpose as AdminPaymentRecord["purpose"])
      : "OTHER",
    paymentStatus: (PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
      ? (paymentStatus as AdminPaymentRecord["paymentStatus"])
      : "INITIATED",
    provider: asString(raw.provider) ?? null,
    currency: isCurrency(raw.currency) ? raw.currency : null,
    amount: asNumber(raw.amount) ?? 0,
    amountPaise: asNumber(raw.amountPaise) ?? Math.round((asNumber(raw.amount) ?? 0) * 100),
    orderId: asString(raw.orderId) ?? id,
    receipt: asString(raw.receipt) ?? null,
    idempotencyKey: asString(raw.idempotencyKey) ?? null,
    customer: customerRaw
      ? {
          name: asString(customerRaw.name) ?? "",
          email: asString(customerRaw.email) ?? "",
          phone: asString(customerRaw.phone) ?? null,
        }
      : { name: "", email: "", phone: null },
    entity: entityRaw
      ? {
          kind: asString(entityRaw.kind) ?? "",
          id: asString(entityRaw.id) ?? "",
          title: asString(entityRaw.title) ?? null,
        }
      : null,
    paymentId: asString(raw.paymentId) ?? null,
    paymentCompletedAt: toIso(raw.paymentCompletedAt) ?? null,
    refund: refundRaw
      ? {
          refundId: asString(refundRaw.refundId) ?? "",
          status: asString(refundRaw.status) ?? "",
          amount: asNumber(refundRaw.amount) ?? 0,
          refundedAt: toIso(refundRaw.refundedAt) ?? "",
        }
      : null,
    createdAt: toIso(raw.createdAt) ?? null,
    updatedAt: toIso(raw.updatedAt) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Submission write builders (M3.3B) — flatten form values into the
// FIRESTORE_DATA_MODEL document shapes, enforcing the M3.3A write contract
// (PENDING + consentGiven + antiSpamToken, no ADMIN-ONLY fields).
// ---------------------------------------------------------------------------

function parseRequestSchema(
  values: RequestSponsorshipFormValues,
): { ok: true } | { ok: false; message: string } {
  const result = requestSponsorshipSchema.safeParse(values);
  return result.success
    ? { ok: true }
    : { ok: false, message: result.error.issues[0]?.message ?? "Invalid submission" };
}

function parseApplicationSchema(
  values: SponsorApplicationFormValues,
): { ok: true } | { ok: false; message: string } {
  const result = sponsorApplicationSchema.safeParse(values);
  return result.success
    ? { ok: true }
    : { ok: false, message: result.error.issues[0]?.message ?? "Invalid submission" };
}

export function buildSponsorshipRequestDoc(values: RequestSponsorshipFormValues): Record<string, unknown> {
  const now = new Date().toISOString();
  const isAthlete = values.requestFor === "athlete";
  const athlete = values.athleteFields;
  const team = values.teamFields;
  const shared = {
    type: isAthlete ? "athlete" : "group",
    status: "PENDING",
    consentGiven: values.consentGiven === true,
    antiSpamToken: values.antiSpamToken,
    contactPerson: values.fullName,
    email: values.email,
    phone: values.phone || null,
    organization: values.organization || null,
    story: isAthlete ? (athlete?.sponsorshipPurpose ?? "") : (team?.sponsorshipPurpose ?? ""),
    sponsorshipNeeds: isAthlete
      ? (athlete?.sponsorshipNeeds ?? "")
      : (team?.sponsorshipNeeds ?? ""),
    formNonce: values.formNonce ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return isAthlete && athlete
    ? {
        ...shared,
        fullName: athlete.athleteName,
        sport: athlete.athleteSport,
        level: athlete.athleteLevel ?? null,
        dateOfBirth: athlete.dateOfBirth,
        location: athlete.location ?? null,
        currentRanking: athlete.currentRanking ?? null,
        coach: athlete.coach ?? null,
        academy: athlete.academy ?? null,
        majorAchievements: athlete.majorAchievements ?? null,
        upcomingCompetitions: athlete.upcomingCompetitions ?? null,
        amountRequested: athlete.amountRequested ?? null,
        documents: athlete.documents ?? [],
        socialMedia: athlete.socialMedia ?? null,
      }
    : team
      ? {
          ...shared,
          groupName: team.teamName,
          sport: team.teamSport,
          level: team.teamLevel,
          location: team.location ?? null,
          memberCount: team.memberCount ?? null,
          establishedYear: team.establishedYear ?? null,
          contactRole: team.contactRole ?? null,
          coachCount: team.coachCount ?? null,
          coaches: team.coachesDetails ?? null,
          majorAchievements: team.achievements ?? null,
          competitions: team.competitions ?? null,
          amountRequested: team.amountRequested ?? null,
          documents: team.documents ?? [],
          website: team.website ?? null,
          socialMedia: team.socialMedia ?? null,
        }
      : shared;
}

/**
 * Write builder for a sponsorship/payment record →
 * `sponsorApplications/{id}`. Every sponsorship begins unpaid (`INITIATED`)
 * with the Razorpay seam wired for a future server-side payment adapter; the
 * `PAID`/`FAILED`/`REFUNDED` transitions are never produced by the browser.
 * `paymentId` / `orderId` / `paymentCompletedAt` are server-assigned and
 * intentionally absent here (the rules reject them on public create).
 */
export function buildSponsorApplicationDoc(values: SponsorApplicationFormValues): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    status: "PENDING",
    paymentStatus: "INITIATED",
    paymentProvider: "razorpay",
    currency: "INR",
    amount: values.amount,
    consentGiven: values.consentGiven === true,
    antiSpamToken: values.antiSpamToken,
    interestType: values.organizationType === "individual" ? "individual" : "organization",
    orgName: values.organizationName,
    contactName: values.contactName,
    email: values.email,
    phone: values.phone || null,
    website: values.website || null,
    supportKind: values.sponsorshipLevel,
    message: values.message,
    formNonce: values.formNonce ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function parseContactSchema(
  values: ContactMessageFormValues,
): { ok: true } | { ok: false; message: string } {
  const result = contactMessageSchema.safeParse(values);
  return result.success
    ? { ok: true }
    : { ok: false, message: result.error.issues[0]?.message ?? "Invalid submission" };
}

function buildContactMessageDoc(values: ContactMessageFormValues): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    status: "PENDING",
    consentGiven: values.consentGiven === true,
    antiSpamToken: values.antiSpamToken,
    name: values.name,
    email: values.email,
    phone: values.phone || null,
    subject: values.subject,
    message: values.message,
    formNonce: values.formNonce ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function parseDonationSchema(
  values: DonationPledgeFormValues,
): { ok: true } | { ok: false; message: string } {
  const result = donationPledgeSchema.safeParse(values);
  return result.success
    ? { ok: true }
    : { ok: false, message: result.error.issues[0]?.message ?? "Invalid submission" };
}

function buildDonationPledgeDoc(values: DonationPledgeFormValues): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    status: "PENDING",
    consentGiven: values.consentGiven === true,
    antiSpamToken: values.antiSpamToken,
    donorName: values.fullName,
    email: values.email,
    phone: values.phone || null,
    amount: values.amount,
    frequency: values.frequency,
    message: values.message || null,
    formNonce: values.formNonce ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class FirestoreDataAdapter {
  private readonly firestore: Firestore | null;

  constructor(firestore: Firestore | null) {
    this.firestore = firestore;
  }

  private get enabled(): boolean {
    return firebaseEnabled && this.firestore !== null;
  }

  // ----- generic read helpers -----

  private pageFrom<T>(
    snaps: QueryDocumentSnapshot<DocumentData>[],
    map: (id: string, raw: DocumentData) => T,
  ): CursorPage<T> {
    return {
      items: snaps.map((s) => map(s.id, s.data())),
      nextCursor: snaps.length > 0 ? snaps[snaps.length - 1]?.id : undefined,
    };
  }

  private async runPage<T>(
    col: string,
    map: (id: string, raw: DocumentData) => T,
    constraints: QueryConstraint[],
    cursor?: string,
  ): Promise<CursorPage<T>> {
    if (!this.enabled || !this.firestore) {
      return { items: [], nextCursor: undefined };
    }
    const ref = collection(this.firestore, col);
    const base = [limit(PAGE_SIZE), ...constraints];
    const q =
      cursor && cursor.length > 0
        ? query(ref, ...base, orderBy("__name__"), startAfter(cursor))
        : query(ref, ...base, orderBy("__name__"));
    const snapshot = await getDocs(q);
    return this.pageFrom(snapshot.docs, map);
  }

private async readOne<T>(
    col: string,
    id: string,
    map: (id: string, raw: DocumentData) => T,
    required?: (raw: DocumentData) => boolean,
  ): Promise<T | null> {
    if (!this.enabled || !this.firestore) return null;
    const snap = await getDoc(doc(this.firestore, col, id));
    if (!snap.exists()) return null;
    const raw = snap.data();
    if (required && !required(raw)) return null;
    return map(snap.id, raw);
  }

  private async listAll<T>(
    col: string,
    map: (id: string, raw: DocumentData) => T,
    constraints: QueryConstraint[],
  ): Promise<T[]> {
    if (!this.enabled || !this.firestore) return [];
    const ref = collection(this.firestore, col);
    const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
    const snapshot = await getDocs(q);
    return snapshot.docs.map((s) => map(s.id, s.data()));
  }

  // ----- Public athletes -----
  listPublicAthletes(options?: { sport?: string; cursor?: string }): Promise<CursorPage<Athlete>> {
    const constraints: QueryConstraint[] = [where("approvalStatus", "==", APPROVED)];
    if (options?.sport) constraints.push(where("sport", "==", options.sport));
    return this.runPage("athletes", mapAthlete, constraints, options?.cursor);
  }

  getPublicAthlete(id: string): Promise<Athlete | null> {
    return this.readOne("athletes", id, mapAthlete, (raw) => raw.approvalStatus === APPROVED);
  }

  listAdminAthletes(cursor?: string): Promise<CursorPage<AdminAthlete>> {
    return this.runPage("athletes", mapAdminAthlete, [], cursor);
  }

  // ----- Groups -----
  listPublicGroups(options?: { groupType?: string; cursor?: string }): Promise<CursorPage<Group>> {
    const constraints: QueryConstraint[] = [where("approvalStatus", "==", APPROVED)];
    if (options?.groupType) constraints.push(where("groupType", "==", options.groupType));
    return this.runPage("groups", mapGroup, constraints, options?.cursor);
  }

  getPublicGroup(id: string): Promise<Group | null> {
    return this.readOne("groups", id, mapGroup, (raw) => raw.approvalStatus === APPROVED);
  }

  listAdminGroups(cursor?: string): Promise<CursorPage<AdminGroup>> {
    return this.runPage("groups", mapAdminGroup, [], cursor);
  }

  // ----- Events (public: upcoming/past only) -----
  listPublicEvents(cursor?: string): Promise<CursorPage<Event>> {
    return this.runPage(
      "events",
      mapEvent,
      [where("status", "in", ["upcoming", "past"])],
      cursor,
    );
  }

  getPublicEvent(id: string): Promise<Event | null> {
    return this.readOne("events", id, mapEvent, (raw) =>
      ["upcoming", "past"].includes(raw.status),
    );
  }

  listAdminEvents(cursor?: string): Promise<CursorPage<AdminEvent>> {
    return this.runPage("events", mapAdminEvent, [], cursor);
  }

  // ----- Stories (public: published only) -----
  listPublicStories(cursor?: string): Promise<CursorPage<Story>> {
    return this.runPage("stories", mapStory, [where("published", "==", true)], cursor);
  }

  getPublicStory(id: string): Promise<Story | null> {
    return this.readOne("stories", id, mapStory, (raw) => raw.published === true);
  }

  listAdminStories(cursor?: string): Promise<CursorPage<AdminStory>> {
    return this.runPage("stories", mapAdminStory, [], cursor);
  }

  // ----- Gallery (public: all uploads) -----
  listPublicGallery(cursor?: string): Promise<CursorPage<GalleryImage>> {
    return this.runPage("galleryImages", mapGalleryImage, [], cursor);
  }

  listAdminGallery(cursor?: string): Promise<CursorPage<AdminGalleryImage>> {
    return this.runPage("galleryImages", mapAdminGalleryImage, [], cursor);
  }

  // ----- Partners (public: active + consented) -----
  listPublicPartners(cursor?: string): Promise<CursorPage<Partner>> {
    return this.runPage(
      "partners",
      mapPartner,
      [where("active", "==", true), where("consentGiven", "==", true)],
      cursor,
    );
  }

  listAdminPartners(cursor?: string): Promise<CursorPage<AdminPartner>> {
    return this.runPage("partners", mapAdminPartner, [], cursor);
  }

  // ----- Opportunities (public: open only) -----
  listPublicOpportunities(cursor?: string): Promise<CursorPage<Opportunity>> {
    return this.runPage("opportunities", mapOpportunity, [where("status", "==", "open")], cursor);
  }

  // ----- Sport disciplines (public: active only) -----
  listPublicSportDisciplines(): Promise<SportDiscipline[]> {
    return this.listAll("sportDisciplines", mapSportDiscipline, [
      where("active", "==", true),
    ]);
  }

  // ----- Inbox (admin reads) -----
  async listInbox(_cursor?: string): Promise<CursorPage<InboxItem>> {
    if (!this.enabled || !this.firestore) return { items: [], nextCursor: undefined };
    const kinds: Array<{ col: string; map: (id: string, raw: DocumentData) => InboxItem }> = [
      {
        col: "sponsorshipRequests",
        map: (id, raw) => {
          const type = raw.type === "group" ? "group" : "athlete";
          return {
            kind: "request",
            id,
            type,
            status: asString(raw.status) ?? "PENDING",
            createdAt: toIso(raw.createdAt),
            summary: asString(raw.type === "group" ? raw.groupName : raw.fullName) ?? "",
            documents: Array.isArray(raw.documents)
              ? raw.documents
                  .map((d) =>
                    typeof d === "string"
                      ? d
                      : d && typeof d === "object" && typeof (d as { fileName?: unknown }).fileName === "string"
                        ? (d as { fileName: string }).fileName
                        : undefined,
                  )
                  .filter((v): v is string => typeof v === "string" && v.length > 0)
              : [],
          };
        },
      },
      {
        col: "sponsorApplications",
        map: (id, raw) => ({
          kind: "application",
          id,
          type: asString(raw.interestType) ?? "organization",
          status: asString(raw.status) ?? "PENDING",
          createdAt: toIso(raw.createdAt),
          summary: asString(raw.orgName ?? raw.contactName) ?? "",
        }),
      },
      {
        col: "contactMessages",
        map: (id, raw) => ({
          kind: "contact",
          id,
          type: asString(raw.subject) ?? "Contact",
          createdAt: toIso(raw.createdAt),
          summary: `${asString(raw.name) ?? "Unknown"} — ${asString(raw.subject) ?? "Contact"}`,
          email: asString(raw.email) ?? null,
          phone: asString(raw.phone) ?? null,
          message: asString(raw.message) ?? null,
        }),
      },
    ];

    const items: InboxItem[] = [];
    for (const { col, map } of kinds) {
      const ref = collection(this.firestore, col);
      const q = query(ref, orderBy("createdAt", "asc"), limit(50));
      const snap = await getDocs(q);
      items.push(...snap.docs.map((s) => map(s.id, s.data())));
    }
    items.sort((a, b) =>
      (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
    return { items, nextCursor: undefined };
  }

  /** Admin list of sponsor applications (SA/ADMIN monitoring; newest-surface first). */
  listAdminSponsorApplications(cursor?: string): Promise<CursorPage<AdminSponsorApplication>> {
    return this.runPage("sponsorApplications", mapAdminSponsorApplication, [], cursor);
  }

  /** Admin by-id read of the full `sponsorshipRequests/{id}` application. */
  getAdminSponsorshipRequest(id: string): Promise<AdminSponsorshipRequest | null> {
    return this.readOne("sponsorshipRequests", id, mapAdminSponsorshipRequest);
  }

  /** Admin by-id read of the full `sponsorApplications/{id}` record. */
  getAdminSponsorApplication(id: string): Promise<AdminSponsorApplication | null> {
    return this.readOne("sponsorApplications", id, mapAdminSponsorApplication);
  }

  /** Admin read of the universal server-owned payment ledger (SA/ADMIN only). */
  listPaymentRecords(cursor?: string): Promise<CursorPage<AdminPaymentRecord>> {
    return this.runPage("paymentRecords", mapPaymentRecord, [], cursor);
  }

  // ----- Public submission writes (M3.3B) -----

  /**
   * Common write path for public submissions. Validates via the shared Zod
   * schema, enforces the M3.3A write contract (PENDING + consent + token,
   * no ADMIN-ONLY fields), dedupes by `formNonce`, and writes the flattened
   * document. Firebase-disabled → safe no-op (`firebase-disabled`).
   */
  private async writeSubmission<T extends { formNonce?: string }>(
    col: string,
    buildDoc: (values: T) => Record<string, unknown>,
    validate: (values: T) => { ok: true } | { ok: false; message: string },
    values: T,
    extras?: Record<string, unknown>,
  ): Promise<SubmissionResult> {
    if (!this.firestore) {
      return { ok: false, reason: "firebase-disabled" };
    }

    const checked = validate(values);
    if (!checked.ok) {
      return { ok: false, reason: "invalid", message: checked.message };
    }

    // formNonce doubles as the Firestore document ID, so it must be an
    // ID-safe string ([A-Za-z0-9_-]); anything else is regenerated so a
    // malformed value can never bypass deterministic-ID dedupe.
    const provided = typeof values.formNonce === "string" ? values.formNonce.trim() : "";
    const nonce =
      provided.length > 0 && /^[A-Za-z0-9_-]+$/.test(provided)
        ? provided
        : createFormNonce();

    // Idempotency is enforced by the RULES, never by a client read:
    // the formNonce is used as the deterministic document ID and written with
    // a create-only write (see below). Firestore treats a write to an existing
    // path as an update, and the rules deny anonymous updates — so a reused
    // formNonce can never create a second document, and no anonymous read is
    // ever performed on the public submission path.

    // The public sponsorship wizards map empty optional inputs to `undefined`
    // at the top level and inside nested structures (`documents[].documentType`,
    // `socialMedia.*`). Firestore rejects an `undefined` field at ANY depth with
    // "Unsupported field value: undefined", so strip the whole doc recursively
    // (never just the top level) before the write reaches `addDoc`. Meaningful
    // values — `null`, `""`, `0`, `false` — are preserved.
    const payload = stripUndefinedValuesDeep(
      stripForbiddenWriteFields({
        ...buildDoc({ ...values, formNonce: nonce }),
        ...(extras ?? {}),
      }),
    );

    // Deterministic-ID create-only write: the document ID is the formNonce,
    // so writing to the same path twice is treated by Firestore as an UPDATE
    // of an existing doc — which the rules deny for anonymous clients. A reused
    // formNonce therefore can never create a second submission, and a fresh
    // formNonce always creates a new one. No anonymous READ is performed.
    try {
      await setDoc(doc(this.firestore, col, nonce), payload, { merge: false });
      markSubmissionConfirmed(nonce);
      return { ok: true, id: nonce };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied" && wasSubmissionConfirmed(nonce)) {
        // This client already wrote this formNonce successfully, so the
        // target path exists: the rules demoted this retry to an UPDATE and
        // denied it. No second document was written — honestly a duplicate.
        return {
          ok: false,
          reason: "duplicate",
          message: "This form was already submitted successfully.",
        };
      }
      // permission-denied is also the code for EVERY other create-denial
      // (fresh-nonce rule validation failure, signed-in submitters tripping
      // the anonymous-create gate, deployed-rules drift) — none of which
      // proves the formNonce already exists. Surface the real denial instead
      // of claiming a successful submission.
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : "Write failed",
      };
    }
  }

  /** Submit a public sponsorship request → `sponsorshipRequests/{id}`. */
  submitSponsorshipRequest(values: RequestSponsorshipFormValues): Promise<SubmissionResult> {
    return this.writeSubmission(
      "sponsorshipRequests",
      buildSponsorshipRequestDoc,
      (v) => parseRequestSchema(v),
      values,
    );
  }

  /** Submit a public sponsor application → `sponsorApplications/{id}`. */
  submitSponsorApplication(
    values: SponsorApplicationFormValues,
    athleteReference?: { id?: string; name?: string; sport?: string } | null,
  ): Promise<SubmissionResult> {
    const athlete = athleteReference && (athleteReference.id || athleteReference.name || athleteReference.sport)
      ? athleteReference
      : null;
    const extras = athlete
      ? { athleteRef: { id: athlete.id ?? null, name: athlete.name ?? null, sport: athlete.sport ?? null } }
      : {};
    return this.writeSubmission(
      "sponsorApplications",
      buildSponsorApplicationDoc,
      (v) => parseApplicationSchema(v),
      values,
      extras,
    );
  }

  /** Submit a public contact message → `contactMessages/{id}`. */
  submitContactMessage(values: ContactMessageFormValues): Promise<SubmissionResult> {
    return this.writeSubmission(
      "contactMessages",
      buildContactMessageDoc,
      (v) => parseContactSchema(v),
      values,
    );
  }

  /** Submit a public donation pledge → `donationPledges/{id}`. */
  submitDonationPledge(values: DonationPledgeFormValues): Promise<SubmissionResult> {
    return this.writeSubmission(
      "donationPledges",
      buildDonationPledgeDoc,
      (v) => parseDonationSchema(v),
      values,
    );
  }

  // ----- Admin catalogue CRUD (M3.3C1) -----

  private async adminWrite(
    kind: EntityKind,
    actor: AdminActor,
    op:
      | { type: "create"; data: Record<string, unknown> }
      | { type: "update"; id: string; data: Record<string, unknown> }
      | { type: "delete"; id: string },
  ): Promise<AdminMutationResult> {
    if (!this.firestore) {
      return { ok: false, reason: "firebase-disabled" };
    }
    if (!isStaffRole(actor.role)) {
      return { ok: false, reason: "unauthorized" };
    }

    const col = CATALOGUE_COLLECTIONS[kind];
    const schema = CATALOGUE_SCHEMAS[kind];

    try {
      if (op.type === "delete") {
        // Rules: delete is SUPER_ADMIN/ADMIN only — CONTENT_MANAGER cannot.
        if (!isAdminRole(actor.role)) {
          return { ok: false, reason: "unauthorized" };
        }
        await deleteDoc(doc(this.firestore, col, op.id));
        return { ok: true, id: op.id };
      }

      // Shape validation (both create and update).
      const checked = schema.safeParse(op.data);
      if (!checked.success) {
        return {
          ok: false,
          reason: "invalid",
          message: checked.error.issues[0]?.message ?? "Invalid data",
        };
      }

      if (op.type === "create") {
        const document = { ...op.data, ...CREATE_DEFAULTS[kind] };
        const ref = await addDoc(collection(this.firestore, col), document);
        return { ok: true, id: ref.id };
      }

      // update
      if (!isAdminRole(actor.role)) {
        const blocked = this.cmBlockedField(kind, op.data);
        if (blocked) {
          return {
            ok: false,
            reason: "forbidden-field",
            message: `CONTENT_MANAGER cannot change '${blocked}'`,
          };
        }
      }

      await updateDoc(doc(this.firestore, col, op.id), op.data);
      return { ok: true, id: op.id };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "not-found") {
        return { ok: false, reason: "not-found", message: "Document not found" };
      }
      const detail = err instanceof Error ? err.message : "Mutation failed";
      console.error(
        `[firestore-adapter] adminWrite failed kind=${kind} op=${op.type}${"id" in op ? ` id=${op.id}` : ""} actor=${actor.role}`,
        { code, message: detail, error: err },
      );
      return {
        ok: false,
        reason: "error",
        message: code ? `${code}: ${detail}` : detail,
      };
    }
  }

  /** Return the first field a CONTENT_MANAGER may not change, if any. */
  private cmBlockedField(
    kind: EntityKind,
    data: Record<string, unknown>,
  ): string | null {
    const keys = Object.keys(data);
    const allowlist = CM_UPDATE_ALLOWLIST[kind];
    if (allowlist.length > 0) {
      const outside = keys.find((k) => !allowlist.includes(k));
      if (outside) return outside;
    }
    const forbidden = CM_FORBIDDEN_FIELDS[kind];
    const hit = keys.find((k) => forbidden.includes(k));
    return hit ?? null;
  }

  // --- typed public methods ---
  createAthlete(data: AthleteWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("athletes", actor, { type: "create", data: { ...data } });
  }
  updateAthlete(id: string, data: AthleteWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("athletes", actor, { type: "update", id, data: { ...data } });
  }
  deleteAthlete(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("athletes", actor, { type: "delete", id });
  }

  createGroup(data: GroupWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("groups", actor, { type: "create", data: { ...data } });
  }
  updateGroup(id: string, data: GroupWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("groups", actor, { type: "update", id, data: { ...data } });
  }
  deleteGroup(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("groups", actor, { type: "delete", id });
  }
createEvent(data: EventWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("events", actor, {
      type: "create",
      data: omitUndefinedValues(data),
    });
  }

  updateEvent(id: string, data: EventWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("events", actor, {
      type: "update",
      id,
      data: omitUndefinedValues(data),
    });
  }
  deleteEvent(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("events", actor, { type: "delete", id });
  }

  createStory(data: StoryWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("stories", actor, { type: "create", data: { ...data } });
  }
  updateStory(id: string, data: StoryWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("stories", actor, { type: "update", id, data: { ...data } });
  }
  deleteStory(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("stories", actor, { type: "delete", id });
  }

  createGalleryImage(data: GalleryImageWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("galleryImages", actor, { type: "create", data: { ...data } });
  }
  updateGalleryImage(
    id: string,
    data: GalleryImageWrite,
    actor: AdminActor,
  ): Promise<AdminMutationResult> {
    return this.adminWrite("galleryImages", actor, { type: "update", id, data: { ...data } });
  }
  deleteGalleryImage(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("galleryImages", actor, { type: "delete", id });
  }

  createPartner(data: PartnerWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("partners", actor, { type: "create", data: { ...data } });
  }
  updatePartner(id: string, data: PartnerWrite, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("partners", actor, { type: "update", id, data: { ...data } });
  }
  deletePartner(id: string, actor: AdminActor): Promise<AdminMutationResult> {
    return this.adminWrite("partners", actor, { type: "delete", id });
  }

  // ----- Content blocks (public website copy) -----

  /** Public read of a content block → record of string fields (defaults bliss). */
  getContentBlock(id: string): Promise<Record<string, string> | null> {
    return this.readOne("contentBlocks", id, (_docId, raw) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    });
  }

  /**
   * Upsert a public content block at `contentBlocks/{id}` (deterministic id).
   * Any active staff role may save; rules read the auth session, this method
   * only validates the actor + string-map shape as defence in depth.
   */
  async saveContentBlock(
    id: string,
    data: Record<string, string>,
    actor: AdminActor,
  ): Promise<AdminMutationResult> {
    const fs = this.firestore;
    if (!fs) return { ok: false, reason: "firebase-disabled" };
    if (!isStaffRole(actor.role)) return { ok: false, reason: "unauthorized" };
    if (!/^[a-z0-9-]{1,60}$/.test(id)) {
      return { ok: false, reason: "invalid", message: "Invalid content block id" };
    }
    const checked = contentBlockWriteSchema.safeParse(data);
    if (!checked.success) {
      return {
        ok: false,
        reason: "invalid",
        message: checked.error.issues[0]?.message ?? "Invalid content block",
      };
    }
    try {
      await setDoc(doc(fs, "contentBlocks", id), {
        ...checked.data,
        updatedAt: this.isoNow(),
        updatedBy: actor.role,
      });
      return { ok: true, id };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const detail = err instanceof Error ? err.message : "Content save failed";
      console.error(
        `[firestore-adapter] saveContentBlock failed id=${id} actor=${actor.role}`,
        { code, message: detail, error: err },
      );
      return {
        ok: false,
        reason: "error",
        message: code ? `${code}: ${detail}` : detail,
      };
    }
  }

  // ----- Admin workflow transitions + audit trail (M3.3C3) -----

  private isoNow(): string {
    return new Date().toISOString();
  }

  /**
   * Transactional state transition core: reads the target doc (aborts on
   * stale/absent), validates the transition, applies the write, and appends
   * an immutable auditLogs entry — all in the same transaction (atomicity).
   */
  private async runWorkflowTransition(params: {
    col: string;
    id: string;
    entityKind: string;
    action: string;
    statusField: string;
    targetStatus: unknown;
    actor: WorkflowActor;
    isAllowed: (current: unknown) => boolean;
    apply?: (
      tx: Transaction,
      ref: DocumentReference,
      before: Record<string, unknown>,
    ) => void;
    note?: string | null;
  }): Promise<WorkflowResult> {
    const fs = this.firestore;
    if (!fs) return { ok: false, reason: "firebase-disabled" };
    let fromVal: unknown = null;
    try {
      let auditId = "";
      await runTransaction(fs, async (tx) => {
        const ref = doc(fs, params.col, params.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WorkflowError("not-found");
        const before = snap.data() as Record<string, unknown>;
        const current = before[params.statusField];
        fromVal = current;
        if (!params.isAllowed(current)) {
          throw new WorkflowError(
            "invalid-transition",
            `Cannot transition '${String(current)}' via '${params.action}'`,
          );
        }
        const auditRef = doc(collection(fs, "auditLogs"));
        tx.set(
          auditRef,
          buildAuditEntry({
            entityKind: params.entityKind,
            entityId: params.id,
            action: params.action,
            actor: params.actor,
            before: before[params.statusField] ?? null,
            after: params.targetStatus,
            note: params.note ?? null,
          }),
        );
        params.apply?.(tx, ref, before);
        auditId = auditRef.id;
      });
      return {
        ok: true,
        id: params.id,
        action: params.action,
        auditId,
        from: fromVal == null ? null : String(fromVal),
        to: String(params.targetStatus),
      };
    } catch (err) {
      return mapWorkflowError(err);
    }
  }

  /**
   * Approve/reject/set approval status on an athlete or group.
   * SUPER_ADMIN/ADMIN only (CONTENT_MANAGER cannot change approvalStatus).
   */
  setApprovalStatus(
    kind: "athletes" | "groups",
    id: string,
    to: ApprovalStatus,
    actor: WorkflowActor,
    note?: string,
  ): Promise<WorkflowResult> {
    if (!this.firestore) return Promise.resolve({ ok: false, reason: "firebase-disabled" });
    if (!canRunWorkflow(actor)) return Promise.resolve({ ok: false, reason: "unauthorized" });
    const entityKind = kind === "athletes" ? "athlete" : "group";
    const action =
      to === "approved" ? "APPROVE" : to === "rejected" ? "REJECT" : "SET_APPROVAL_STATUS";
    const data = { id, to: String(to), note };
    void data;
    return this.runWorkflowTransition({
      col: kind,
      id,
      entityKind,
      action,
      statusField: "approvalStatus",
      targetStatus: to,
      actor,
      isAllowed: () => true, // any current approvalStatus -> any other (draft/approved/rejected/pending)
      note: note ?? null,
      apply: (tx, ref) => {
        tx.update(ref, { approvalStatus: to, updatedAt: this.isoNow() });
      },
    });
  }

  /** Publish/unpublish a story, preserving the first `publishedAt`. CM allowed. */
  setStoryPublished(id: string, published: boolean, actor: WorkflowActor): Promise<WorkflowResult> {
    if (!this.firestore) return Promise.resolve({ ok: false, reason: "firebase-disabled" });
    if (!(isStaffRole(actor.role) && (isAdminRole(actor.role) || actor.role === "CONTENT_MANAGER"))) {
      return Promise.resolve({ ok: false, reason: "unauthorized" });
    }
    const action = published ? "PUBLISHED" : "UNPUBLISHED";
    return this.runWorkflowTransition({
      col: "stories",
      id,
      entityKind: "story",
      action,
      statusField: "published",
      targetStatus: published,
      actor,
      isAllowed: () => true,
      apply: (tx, ref, before) => {
        if (published) {
          tx.update(ref, {
            published: true,
            publishedAt:
              typeof before.publishedAt === "string" && before.publishedAt.length > 0
                ? before.publishedAt
                : this.isoNow(),
            updatedAt: this.isoNow(),
          });
        } else {
          tx.update(ref, { published: false, updatedAt: this.isoNow() });
        }
      },
    });
  }

  /** Activate/deactivate a partner. SUPER_ADMIN/ADMIN only. */
  setPartnerActive(id: string, active: boolean, actor: WorkflowActor): Promise<WorkflowResult> {
    if (!this.firestore) return Promise.resolve({ ok: false, reason: "firebase-disabled" });
    if (!canRunWorkflow(actor)) return Promise.resolve({ ok: false, reason: "unauthorized" });
    return this.runWorkflowTransition({
      col: "partners",
      id,
      entityKind: "partner",
      action: active ? "ACTIVATED" : "DEACTIVATED",
      statusField: "active",
      targetStatus: active,
      actor,
      isAllowed: () => true,
      apply: (tx, ref) => {
        tx.update(ref, { active, updatedAt: this.isoNow() });
      },
    });
  }

  /** Sponsorship REQUEST workflow (REVIEWING / APPROVE(atomic) / REJECT / REOPEN). SA/ADMIN only. */
  transitionRequest(
    id: string,
    action: RequestAction,
    actor: WorkflowActor,
    meta?: { reason?: string },
  ): Promise<WorkflowResult> {
    if (!this.firestore) return Promise.resolve({ ok: false, reason: "firebase-disabled" });
    if (!canRunWorkflow(actor)) return Promise.resolve({ ok: false, reason: "unauthorized" });
    const isReject = action === "reject";
    const reason = meta?.reason;
    if (isReject && !(typeof reason === "string" && reason.trim().length > 0)) {
      return Promise.resolve({ ok: false, reason: "invalid-transition", message: "A rejection reason is required." });
    }

    const target: RequestStatus = (
      {
        review: "REVIEWING",
        approve: "APPROVED",
        reject: "REJECTED",
        reopen: "PENDING",
      } as const satisfies Record<RequestAction, RequestStatus>
    )[action];

    const actionLabel =
      action === "review" ? "REVIEWING"
        : action === "approve" ? "APPROVED"
          : action === "reject" ? "REJECTED"
            : "REOPENED";

    return this.runWorkflowTransition({
      col: "sponsorshipRequests",
      id,
      entityKind: "sponsorshipRequest",
      action: actionLabel,
      statusField: "status",
      targetStatus: target,
      actor,
      isAllowed: (current) => canTransitionRequest(String(current), action),
      note: reason ?? null,
      apply: (tx, ref, before) => {
        tx.update(ref, {
          status: target,
          updatedAt: this.isoNow(),
          ...(action === "review" ? { assignedTo: actor.uid } : {}),
          ...(action === "approve" ? { approvedBy: actor.uid } : {}),
          ...(isReject ? { reason, processedBy: actor.uid } : {}),
          reviewHistory: this.appendReviewHistory(before, target, actor, reason),
        });
        if (action === "approve") {
          this.atomicCreateApprovedProfile(tx, id, before, actor);
        }
      },
    });
  }

  /** Sponsor APPLICATION workflow (REVIEW→REVIEWING / CONTACT / CLOSE / REJECT / REOPEN). SA/ADMIN only. */
  transitionApplication(
    id: string,
    action: ApplicationAction,
    actor: WorkflowActor,
    meta?: { reason?: string },
  ): Promise<WorkflowResult> {
    if (!this.firestore) return Promise.resolve({ ok: false, reason: "firebase-disabled" });
    if (!canRunWorkflow(actor)) return Promise.resolve({ ok: false, reason: "unauthorized" });
    const isReject = action === "reject";
    const reason = meta?.reason;
    if (isReject && !(typeof reason === "string" && reason.trim().length > 0)) {
      return Promise.resolve({ ok: false, reason: "invalid-transition", message: "A rejection reason is required." });
    }

    const target: ApplicationStatus = (
      {
        review: "REVIEWING",
        contact: "CONTACTED",
        close: "CLOSED",
        reject: "REJECTED",
        reopen: "PENDING",
      } as const satisfies Record<ApplicationAction, ApplicationStatus>
    )[action];

    const actionLabel = action.toUpperCase();

    return this.runWorkflowTransition({
      col: "sponsorApplications",
      id,
      entityKind: "sponsorApplication",
      action: actionLabel,
      statusField: "status",
      targetStatus: target,
      actor,
      isAllowed: (current) => canTransitionApplication(String(current), action),
      note: reason ?? null,
      apply: (tx, ref, before) => {
        tx.update(ref, {
          status: target,
          updatedAt: this.isoNow(),
          ...(action === "review" ? { assignedTo: actor.uid } : {}),
          ...(isReject ? { reason, processedBy: actor.uid } : {}),
          reviewHistory: this.appendReviewHistory(before, target, actor, reason),
        });
      },
    });
  }

  private appendReviewHistory(
    before: Record<string, unknown> | null,
    to: unknown,
    actor: WorkflowActor,
    note?: string,
  ): unknown[] {
    const existing = before && Array.isArray(before.reviewHistory) ? before.reviewHistory : [];
    return [
      ...(existing as unknown[]),
      { status: to, byUid: actor.uid, note: note ?? null, at: this.isoNow() },
    ];
  }

  /**
   * Atomically create an approved public athlete/group profile from an
   * approved sponsorship request. The rules require `approvalStatus == 'draft'`
   * on create, so we create as draft then immediately approve within the same
   * transaction — external readers never observe a persistent draft because
   * the transaction commits atomically. `requestId` + `contactInfo` are copied.
   */
  private atomicCreateApprovedProfile(
    tx: Transaction,
    requestId: string,
    request: Record<string, unknown>,
    actor: WorkflowActor,
  ): void {
    const kind = request.type === "athlete" ? "athletes" : "groups";
    const profileRef = doc(collection(this.firestore!, kind));
    const draft: Record<string, unknown> =
      kind === "athletes"
        ? {
            fullName: request.fullName ?? request.organization ?? "",
            sport: request.sport ?? "",
            level: request.level ?? "competitive",
            slug: this.slugify(String(request.fullName ?? request.organization ?? "")),
            approvalStatus: "draft",
            contactInfo: this.requestContactInfo(request),
            requestId,
            createdAt: this.isoNow(),
            updatedAt: this.isoNow(),
          }
        : {
            groupName: request.groupName ?? request.organization ?? "",
            sport: Array.isArray(request.sport) ? request.sport : [request.sport ?? ""],
            level: request.level ?? "competitive",
            slug: this.slugify(String(request.groupName ?? request.organization ?? "")),
            approvalStatus: "draft",
            contactInfo: this.requestContactInfo(request),
            requestId,
            createdAt: this.isoNow(),
            updatedAt: this.isoNow(),
          };
    tx.set(profileRef, draft);
    tx.update(profileRef, {
      approvalStatus: "approved",
      updatedAt: this.isoNow(),
      approvedBy: actor.uid,
    });
  }

  private requestContactInfo(request: Record<string, unknown>): Record<string, unknown> {
    return {
      email: request.email ?? null,
      phone: request.phone ?? null,
      contactPerson: request.contactPerson ?? null,
    };
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : `item-${Date.now()}`;
  }

  /** Read audit entries for a target (SA can read all; ADMIN own-open read helper). */
  async listAuditLogs(): Promise<unknown[]> {
    const fs = this.firestore;
    if (!fs) return [];
    try {
      const coll = collection(fs, "auditLogs");
      const snap = await getDocs(query(coll, orderBy("createdAt", "desc"), limit(200)));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    } catch {
      return [];
    }
  }
}

/** Build the singleton adapter bound to the current Firestore instance. */
export function createFirestoreAdapter(): FirestoreDataAdapter {
  ensureInitialized();
  return new FirestoreDataAdapter(getFirestoreInstance());
}
