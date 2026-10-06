/**
 * Domain models â€” the typed read-side shapes the UI consumes.
 *
 * These are the canonical entity types (FIRESTORE_DATA_MODEL.md). They are
 * produced by the Firestore adapter's mappers and consumed by pages â€” raw
 * Firestore documents never reach the UI. Only PUBLIC/visible fields are
 * exposed; ADMIN-ONLY / PRIVATE fields are intentionally absent from the
 * public shapes. Admin list shapes include the admin-read fields.
 */

export interface MoneyNeed {
  kind: string;
  amount?: string | null;
  note?: string | null;
}

export interface Achievement {
  title: string;
  year?: number | string | null;
  detail?: string | null;
}

export interface CompetitionRow {
  opponent?: string | null;
  event?: string | null;
  result?: string | null;
  date?: string | null;
}

export interface MediaImage {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface SocialLinks {
  instagram?: string | null;
  youtube?: string | null;
  facebook?: string | null;
  website?: string | null;
}

/** Public athlete (approved) â€” ADMIN-ONLY fields stripped. */
export interface Athlete {
  id: string;
  slug: string;
  fullName: string;
  sport: string;
  level?: string | null;
  record?: string | null;
  championships?: number | null;
  medals?: number | null;
  biography?: string | null;
  tagline?: string | null;
  achievements: Achievement[];
  competitionHistory: CompetitionRow[];
  sponsorshipNeeds: MoneyNeed[];
  sponsorshipPurpose?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  images: MediaImage[];
  socialLinks?: SocialLinks | null;
  categories?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/** Public group (approved). */
export interface Group {
  id: string;
  slug: string;
  groupName: string;
  groupType: "team" | "club" | "academy" | "association";
  location?: string | null;
  memberCount?: number | null;
  sports: string[];
  description?: string | null;
  website?: string | null;
  images: MediaImage[];
  sponsorshipNeeds: MoneyNeed[];
  sponsorshipPurpose?: string | null;
  achievements: Achievement[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  type: "informational" | "athlete_or_group_involving" | "sponsorship_opportunity";
  status: "upcoming" | "past" | "draft";
  date: string; // ISO string
  time?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  registrationUrl?: string | null;
  registrationNote?: string | null;
  participantIds?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body?: string | null;
  coverImageUrl?: string | null;
  tags: string[];
  author?: string | null;
  published: boolean;
  publishedAt?: string | null; // ISO string
}

export interface GalleryImage {
  id: string;
  title?: string | null;
  altText: string;
  category: string;
  /** Optional event link â€” media shown under that event's gallery (/events/:eventId). */
  eventId?: string | null;
  publicUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Partner {
  id: string;
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  type: "sponsor" | "academy-group" | "media";
  category?: string | null;
  active: boolean;
}

export interface Opportunity {
  id: string;
  slug: string;
  title: string;
  status: "open" | "closed" | "on_hold";
  type: "athlete" | "group" | "event" | "general";
  description?: string | null;
  needs: MoneyNeed[];
  closesAt?: string | null; // ISO string
  primaryRef?: { kind: string; id: string; name: string } | null;
}

export interface SportDiscipline {
  id: string;
  name: string;
  active: boolean;
}

/** Admin list row for athletes (includes approval status). */
export interface AdminAthlete extends Athlete {
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
  featured?: boolean;
  order?: number;
  updatedAt?: string | null;
}

/** Admin list row for groups (includes approval status). */
export interface AdminGroup extends Group {
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
  featured?: boolean;
  order?: number;
  updatedAt?: string | null;
}

export interface AdminEvent extends Event {
  featured?: boolean;
  order?: number;
  updatedAt?: string | null;
}

export interface AdminStory extends Story {
  updatedAt?: string | null;
}

export interface AdminGalleryImage extends GalleryImage {
  order?: number;
}

export interface AdminPartner extends Partner {
  featured?: boolean;
  order?: number;
}

/** Sponsor APPLICATION â€” the real `sponsorApplications` sponsorship/payment doc an SA/ADMIN monitors. */
export interface AdminSponsorApplication {
  id: string;
  status: "PENDING" | "REVIEWING" | "CONTACTED" | "CLOSED" | "REJECTED";
  /** Payment lifecycle â€” public writes may only create `INITIATED`; `PAID`/`FAILED`/`REFUNDED` are server-assigned. */
  paymentStatus: "INITIATED" | "PAID" | "FAILED" | "REFUNDED";
  interestType: string;
  orgName: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  supportKind: string | null;
  message: string | null;
  /** Committed sponsorship amount (â‚¹). */
  amount: number | null;
  currency: string | null;
  /** Payment gateway â€” "razorpay" for the future server-side pay-gateway adapter. */
  paymentProvider: string | null;
  /** Razorpay payment id â€” server-assigned after a successful payment; null while unpaid. */
  paymentId: string | null;
  /** Razorpay order id â€” server-assigned when an order is created; null until then. */
  orderId: string | null;
  /** Athlete being sponsored, captured from the Support-This-Athlete flow when available. */
  athlete: { id?: string; name?: string; sport?: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  assignedTo?: string | null;
  processedBy?: string | null;
  rejectionReason?: string | null;
  reviewHistory?: unknown[];
}

/** Official verifying a private applicant document. */
export type DocumentVerificationStatus = "not-verified" | "verified";

/**
 * A supporting-document entry attached to a sponsorship request. Only
 * metadata is modelled here â€” never a public URL. `storageRef` / `fileUrl`
 * stay null until a signed, access-controlled private store is connected
 * (see `src/services/private-documents.ts`); until then the admin UI shows
 * the "secure access not configured" state instead of a link.
 */
export interface AdminSponsorshipDocument {
  id: string;
  documentCategory: string;
  documentType: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileType: string | null;
  status: "recorded" | "uploading" | "ready" | "error" | string | null;
  verificationStatus: DocumentVerificationStatus | null;
  uploadedAt: string | null;
}


/** A supporting document attached to a sponsorship request (metadata only). */
export interface AdminSponsorshipDocumentMetadata {
  documentCategory: string | null;
  documentType: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileType: string | null;
  storageRef: string | null;
  fileUrl: string | null;
  status: string | null;
  uploadedAt: string | null;
  verificationStatus: string | null;
}

/**
 * Full persisted record of a sponsorship application â€” a flat `sponsorshipRequests`
 * doc. Discriminated by `type` (`athlete` â†’ fighter, `group` â†’ academy/team) so
 * each variant carries its own fields while sharing the audit + review spine.
 * Backed by the staff-only admin read (no rules/auth change required).
 */
export type AdminSponsorshipRequest =
  | (AdminSponsorshipRequestSpine & {
      type: "athlete";
      /** Fighter */
      fullName: string | null;
      dateOfBirth: string | null;
      currentRanking: string | null;
      coach: string | null;
      academy: string | null;
      majorAchievements: string | null;
      upcomingCompetitions: string | null;
      amountRequested: number | null;
    })
  | (AdminSponsorshipRequestSpine & {
      type: "group";
      /** Academy / team */
      groupName: string | null;
      memberCount: number | null;
      establishedYear: number | null;
      contactRole: string | null;
      coachCount: number | null;
      coaches: string | null;
      competitions: string | null;
      website: string | null;
      amountRequested: number | null;
    });

interface AdminSponsorshipRequestSpine {
  id: string;
  status: string;
  consentGiven: boolean;
  antiSpamToken: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  sport: string | null;
  level: string | null;
  location: string | null;
  story: string | null;
  sponsorshipNeeds: string | null;
  formNonce: string | null;
  socialMedia: Record<string, string> | null;
  documents: AdminSponsorshipDocumentMetadata[];
  createdAt: string | null;
  updatedAt: string | null;
}

/** Inbox item â€” a pending submission requiring review. */
export type InboxItem =
  | {
      kind: "request";
      id: string;
      type: string;
      status?: string;
      createdAt?: string | null;
      summary: string;
      documents?: string[];
    }
  | { kind: "application"; id: string; type: string; status?: string; createdAt?: string | null; summary: string }
  | {
      kind: "contact";
      id: string;
      type: string;
      createdAt?: string | null;
      summary: string;
      email?: string | null;
      phone?: string | null;
      message?: string | null;
    };

/** Site-wide payment purposes (mirrors the server `PaymentState::PURPOSES`). */
export type PaymentPurpose = "SPONSORSHIP" | "DONATION" | "EVENT" | "PROGRAM" | "OTHER";

/** Payment lifecycle (mirrors `PAYMENT_STATUSES` in features/admin/workflow). */
export type PaymentStatus = "INITIATED" | "PAID" | "FAILED" | "REFUNDED";

/**
 * Universal payment record â€” the server-owned `paymentRecords` ledger. Doc id
 * IS the Razorpay order id. Written exclusively by the payment server (PHP
 * gateway) with a service account; the browser can read (staff only) but never
 * writes PAID/REFUNDED/paymentId/orderId anywhere.
 */
export interface AdminPaymentRecord {
  id: string;
  purpose: PaymentPurpose;
  paymentStatus: PaymentStatus;
  provider: string | null;
  currency: string | null;
  amount: number;
  amountPaise: number;
  orderId: string;
  receipt: string | null;
  idempotencyKey: string | null;
  customer: { name: string; email: string; phone: string | null };
  entity: { kind: string; id: string; title: string | null } | null;
  paymentId: string | null;
  paymentCompletedAt: string | null;
  refund: { refundId: string; status: string; amount: number; refundedAt: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}
