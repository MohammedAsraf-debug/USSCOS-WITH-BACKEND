/**
 * M3.3C2 — Editable field descriptors for the admin catalogue manager.
 *
 * Lightweight, per-entity configuration that powers the inline create/edit
 * forms on the existing admin list pages. Every field key maps onto the
 * corresponding M3.3C1 write schema (see `catalogue.ts`) so the same Zod
 * validation still runs before any write.
 *
 * RBAC (mirrors the security contract):
 *  - `adminOnly` fields (approvalStatus, featured, order, published, active,
 *    publishedAt) are rendered ONLY to SUPER_ADMIN/ADMIN and are excluded
 *    from create payloads (the rules force the initial non-public state).
 *  - The non-admin-only fields match the CONTENT_MANAGER update allowlists /
 *    admissibility from `catalogue.ts` and `firestore.rules`.
 */
import type { EntityKind } from "./catalogue";

export type CatalogueFieldType = "text" | "textarea" | "url" | "number" | "select" | "boolean";

export interface CatalogueField {
  key: string;
  label: string;
  type: CatalogueFieldType;
  options?: readonly { value: string; label: string }[];
  /** Only SUPER_ADMIN/ADMIN may see and change this field. */
  adminOnly?: boolean;
}

const approvalOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const eventTypeOptions = [
  { value: "informational", label: "Informational" },
  { value: "athlete_or_group_involving", label: "Fighter / group involving" },
  { value: "sponsorship_opportunity", label: "Sponsorship opportunity" },
] as const;

const eventStatusOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "draft", label: "Draft" },
] as const;

const levelOptions = [
  { value: "recreational", label: "Recreational" },
  { value: "competitive", label: "Competitive" },
  { value: "professional", label: "Professional" },
] as const;

const groupTypeOptions = [
  { value: "team", label: "Team" },
  { value: "club", label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "association", label: "Association" },
] as const;

const partnerTypeOptions = [
  { value: "sponsor", label: "Sponsor" },
  { value: "academy-group", label: "Academy group" },
  { value: "media", label: "Media" },
] as const;

export const CATALOGUE_FIELDS: Record<EntityKind, readonly CatalogueField[]> = {
  athletes: [
    { key: "fullName", label: "Full name", type: "text" },
    { key: "sport", label: "Sport", type: "text" },
    { key: "level", label: "Level", type: "select", options: levelOptions },
    { key: "record", label: "Record", type: "text" },
    { key: "biography", label: "Biography", type: "textarea" },
    { key: "profileImageUrl", label: "Profile image URL", type: "url" },
    { key: "coverImageUrl", label: "Cover image URL", type: "url" },
    { key: "approvalStatus", label: "Approval status", type: "select", options: approvalOptions, adminOnly: true },
    { key: "featured", label: "Featured", type: "boolean", adminOnly: true },
    { key: "order", label: "Order", type: "number", adminOnly: true },
  ],
  groups: [
    { key: "groupName", label: "Group name", type: "text" },
    { key: "groupType", label: "Group type", type: "select", options: groupTypeOptions },
    { key: "location", label: "Location", type: "text" },
    { key: "memberCount", label: "Member count", type: "number" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "website", label: "Website", type: "url" },
    { key: "profileImageUrl", label: "Profile image URL", type: "url" },
    { key: "coverImageUrl", label: "Cover image URL", type: "url" },
    { key: "approvalStatus", label: "Approval status", type: "select", options: approvalOptions, adminOnly: true },
    { key: "featured", label: "Featured", type: "boolean", adminOnly: true },
    { key: "order", label: "Order", type: "number", adminOnly: true },
  ],
  events: [
    { key: "title", label: "Title", type: "text" },
    { key: "type", label: "Type", type: "select", options: eventTypeOptions },
    { key: "status", label: "Status", type: "select", options: eventStatusOptions },
    { key: "date", label: "Date", type: "text" },
    { key: "time", label: "Time", type: "text" },
    { key: "endTime", label: "End time", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "registrationUrl", label: "Registration URL", type: "url" },
    { key: "featured", label: "Featured", type: "boolean", adminOnly: true },
    { key: "order", label: "Order", type: "number", adminOnly: true },
  ],
  stories: [
    { key: "title", label: "Title", type: "text" },
    { key: "author", label: "Author", type: "text" },
    { key: "excerpt", label: "Excerpt", type: "textarea" },
    { key: "body", label: "Body", type: "textarea" },
    { key: "coverImageUrl", label: "Cover image URL", type: "url" },
    { key: "published", label: "Published", type: "boolean", adminOnly: true },
    { key: "publishedAt", label: "Published at", type: "text", adminOnly: true },
  ],
  galleryImages: [
    { key: "title", label: "Title", type: "text" },
    { key: "altText", label: "Alt text", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "eventId", label: "Linked event", type: "text" },
    { key: "publicUrl", label: "Public URL", type: "url" },
    { key: "order", label: "Order", type: "number", adminOnly: true },
  ],
  partners: [
    { key: "name", label: "Name", type: "text" },
    { key: "type", label: "Type", type: "select", options: partnerTypeOptions },
    { key: "category", label: "Category", type: "text" },
    { key: "website", label: "Website", type: "url" },
    { key: "logoUrl", label: "Logo URL", type: "url" },
    { key: "active", label: "Active", type: "boolean", adminOnly: true },
    { key: "featured", label: "Featured", type: "boolean", adminOnly: true },
    { key: "order", label: "Order", type: "number", adminOnly: true },
  ],
};

/** Natural label used for a catalogue row in the manager list. */
export function catalogueRowLabel(kind: EntityKind): string {
  switch (kind) {
    case "athletes":
      return "fullName";
    case "groups":
      return "groupName";
    case "events":
    case "stories":
      return "title";
    case "galleryImages":
      return "altText";
    case "partners":
      return "name";
  }
}

/** Human-readable entity noun used in button/labels. */
export function catalogueEntityNoun(kind: EntityKind): string {
  switch (kind) {
    case "galleryImages":
      return "image";
    case "partners":
      return "partner";
    case "athletes":
      return "athlete";
    case "groups":
      return "group";
    case "events":
      return "event";
    case "stories":
      return "story";
  }
}
