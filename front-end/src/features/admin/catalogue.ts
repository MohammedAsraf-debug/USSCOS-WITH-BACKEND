/**
 * Admin catalogue mutation foundation (M3.3C1).
 *
 * Centralised, typed write contracts for the admin catalogue entities:
 * athletes, groups, events, stories, galleryImages, partners.
 *
 * Mirrors FIRESTORE_DATA_MODEL.md + the M3.3A security rules so the
 * FirestoreAdapter can enforce role-based restrictions (CONTENT_MANAGER vs
 * SUPER_ADMIN/ADMIN) and admin-only field protection as defence-in-depth.
 * The Firestore rules remain the ultimate authority at write time; this
 * module's allowlists match them exactly.
 */
import { z } from "zod";
import type { UserRole } from "@/types";

/** Acting admin (role is the same `users/{uid}` authority as the rules). */
export interface AdminActor {
  role: UserRole;
}

export type AdminRole = UserRole;

/** Roles permitted to mutate admin-only / protected fields and to delete. */
export const ADMIN_ONLY_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"];

// ---------------------------------------------------------------------------
// Zod write schemas (validate shape + enums at the data layer)
// ---------------------------------------------------------------------------

const level = z.string().nullish();
const url = z.union([z.string().url(), z.literal("")]).nullish();
const socialLinks = z
  .object({
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    facebook: z.string().optional(),
    website: z.string().optional(),
  })
  .optional();

export const athleteWriteSchema = z.object({
  slug: z.string().min(1).optional(),
  fullName: z.string().min(1),
  sport: z.string().min(1),
  level: level,
  record: z.string().nullish(),
  championships: z.number().int().nonnegative().optional(),
  medals: z.number().int().nonnegative().optional(),
  biography: z.string().nullish(),
  tagline: z.string().nullish(),
  achievements: z.array(z.unknown()).optional(),
  competitionHistory: z.array(z.unknown()).optional(),
  sponsorshipNeeds: z.array(z.unknown()).optional(),
  sponsorshipPurpose: z.string().nullish(),
  profileImageUrl: url,
  coverImageUrl: url,
  images: z.array(z.unknown()).optional(),
  socialLinks,
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
});

export const groupWriteSchema = z.object({
  slug: z.string().min(1).optional(),
  groupName: z.string().min(1),
  groupType: z.enum(["team", "club", "academy", "association"]).optional(),
  location: z.string().nullish(),
  memberCount: z.number().int().nonnegative().optional(),
  sports: z.array(z.string().min(1)).optional(),
  description: z.string().nullish(),
  website: url,
  biography: z.string().nullish(),
  achievements: z.array(z.unknown()).optional(),
  competitionHistory: z.array(z.unknown()).optional(),
  sponsorshipNeeds: z.array(z.unknown()).optional(),
  sponsorshipPurpose: z.string().nullish(),
  profileImageUrl: url,
  coverImageUrl: url,
  images: z.array(z.unknown()).optional(),
  socialLinks,
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
});

export const eventWriteSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["informational", "athlete_or_group_involving", "sponsorship_opportunity"]).optional(),
  status: z.enum(["upcoming", "past", "draft"]).optional(),
  date: z.string().min(1).optional(),
  time: z.string().nullish(),
  endTime: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  coverImageUrl: url,
  registrationUrl: url,
  registrationNote: z.string().nullish(),
  participantIds: z.array(z.string()).optional(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
});

export const storyWriteSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().nullish(),
  body: z.string().nullish(),
  coverImageUrl: url,
  tags: z.array(z.string()).optional(),
  author: z.string().nullish(),
  publishedAt: z.string().nullish(),
});

export const galleryImageWriteSchema = z.object({
  title: z.string().nullish(),
  altText: z.string().min(1),
  category: z.string().min(1),
  /** Optional event link; empty → general gallery content. Old docs lack the key. */
  eventId: z.string().nullish(),
  publicUrl: z.string().min(1),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
});

export const partnerWriteSchema = z.object({
  name: z.string().min(1),
  logoUrl: url,
  website: url,
  type: z.enum(["sponsor", "academy-group", "media"]).optional(),
  category: z.string().nullish(),
});

/**
 * Public website content block (homepage/about/contact/stats copy) — a flat
 * map of string fields keyed by the block id (`contentBlocks/{id}`). Public
 * write decisions are covered by the generic `isStaff()` rules; this schema
 * only guarantees the client never persists non-string values.
 */
export const contentBlockWriteSchema = z.record(z.string(), z.string());

/**
 * Strip `undefined` values before a Firestore write. Firestore rejects
 * undefined fields (addDoc/updateDoc throw "Unsupported field value:
 * undefined"). Admin forms map empty optional inputs (e.g. an Event End Time
 * that is left blank) to `undefined`, so those writable keys are simply
 * omitted from the document. The schema-approved empty values `null` and `""`
 * are preserved. Applied on the events create/update write path so the
 * optional-field contract is unchanged.
 */
export function omitUndefinedValues(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined) cleaned[key] = data[key];
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Update-time field controls (mirror the M3.3A rules' CM allowlists)
// ---------------------------------------------------------------------------

/** Fields a CONTENT_MANAGER may change on update (rules `affectedKeys().hasOnly`). */
export const CM_UPDATE_ALLOWLIST: Record<EntityKind, readonly string[]> = {
  athletes: [
    "fullName", "sport", "level", "record", "championships", "medals",
    "biography", "achievements", "competitionHistory",
    "sponsorshipNeeds", "sponsorshipPurpose",
    "profileImageUrl", "coverImageUrl", "images", "socialLinks",
    "seoTitle", "seoDescription",
  ],
  groups: [
    "groupName", "groupType", "sports", "memberCount", "location",
    "description", "website", "biography", "achievements",
    "competitionHistory", "sponsorshipNeeds", "sponsorshipPurpose",
    "profileImageUrl", "coverImageUrl", "images", "socialLinks",
    "seoTitle", "seoDescription",
  ],
  events: [
    "title", "type", "status", "date", "time", "endTime",
    "location", "description", "coverImageUrl",
    "registrationUrl", "registrationNote",
    "participantIds",
    "seoTitle", "seoDescription",
  ],
  stories: [],
  galleryImages: [],
  partners: [], // partners allowlist is expressed via forbidden fields only
};

/** Protected/admin-only update fields — only SUPER_ADMIN/ADMIN may change them. */
export const ADMIN_ONLY_FIELDS: Record<EntityKind, readonly string[]> = {
  athletes: ["approvalStatus", "featured", "order", "contactInfo", "updatedAt"],
  groups: ["approvalStatus", "featured", "order", "contactInfo", "updatedAt"],
  events: ["featured", "order", "updatedAt"],
  stories: ["updatedAt"],
  galleryImages: ["order", "updatedAt"],
  partners: ["featured", "order", "active", "consentGiven", "updatedAt"],
};

/**
 * Fields a CONTENT_MANAGER may NEVER change, whatever the allowlist:
 * the union of the rules' `hasAny`/`hasNone` protections plus timestamps.
 */
export const CM_FORBIDDEN_FIELDS: Record<EntityKind, readonly string[]> = {
  athletes: ["approvalStatus", "featured", "order", "contactInfo", "updatedAt"],
  groups: ["approvalStatus", "featured", "order", "contactInfo", "updatedAt"],
  events: ["featured", "order", "updatedAt"],
  stories: ["updatedAt"],
  galleryImages: ["order", "updatedAt"],
  partners: ["featured", "order", "active", "consentGiven", "updatedAt"],
};

/** Collection names for the catalogue entities. */
export const CATALOGUE_COLLECTIONS: Record<EntityKind, string> = {
  athletes: "athletes",
  groups: "groups",
  events: "events",
  stories: "stories",
  galleryImages: "galleryImages",
  partners: "partners",
};

/** Fields forced at create time by the rules (non-public initial state). */
export const CREATE_DEFAULTS: Record<EntityKind, Record<string, unknown>> = {
  athletes: { approvalStatus: "draft" },
  groups: { approvalStatus: "draft" },
  events: {},
  stories: { published: false },
  galleryImages: {},
  partners: { active: false },
};

export type EntityKind =
  | "athletes"
  | "groups"
  | "events"
  | "stories"
  | "galleryImages"
  | "partners";

/** Per-entity write schema keyed by kind. */
export const CATALOGUE_SCHEMAS: Record<EntityKind, z.ZodTypeAny> = {
  athletes: athleteWriteSchema,
  groups: groupWriteSchema,
  events: eventWriteSchema,
  stories: storyWriteSchema,
  galleryImages: galleryImageWriteSchema,
  partners: partnerWriteSchema,
};

/** True when a role may change/admin-only fields and delete. */
export function canAdmin(kind: EntityKind, role: UserRole): boolean {
  void kind;
  return ADMIN_ONLY_ROLES.includes(role);
}

// Inferred write input types for the typed public adapter methods.
export type AthleteWrite = z.input<typeof athleteWriteSchema>;
export type GroupWrite = z.input<typeof groupWriteSchema>;
export type EventWrite = z.input<typeof eventWriteSchema>;
export type StoryWrite = z.input<typeof storyWriteSchema>;
export type GalleryImageWrite = z.input<typeof galleryImageWriteSchema>;
export type PartnerWrite = z.input<typeof partnerWriteSchema>;
