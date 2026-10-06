/**
 * Shared domain types (M0): minimal set needed by the foundation seams.
 * Full discriminated unions per entity arrive with their feature milestones.
 */

/** Admin roles (RBAC — ADMIN_PERMISSION_MATRIX / RBAC_IMPLEMENTATION). */
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "CONTENT_MANAGER";

/** Public visibility gating for records (PART C, STATE_AND_EDGE_CASES). */
export type PublicVisibility = "PUBLISHED" | "DRAFT" | "HIDDEN" | "REMOVED";
