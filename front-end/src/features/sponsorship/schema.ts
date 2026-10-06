/**
 * Sponsorship form schema tree — shared engine, one schema with shared +
 * type-specific sets. Decision point (who are you seeking sponsorship for?)
 * [ATHLETE] / [TEAM/GROUP] is a single radio set before any type-specific
 * fields switch. Switching type clears type-specific fields with warning;
 * shared fields persist.
 *
 * Schemas live here so the single submission engine in FORM_ARCHITECTURE.md §1-2
 * can import them without duplication.
 */

import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/phone";
import { isValidDateString, isFutureDate } from "@/lib/date";

// ---------- Shared document-entry shape (private applicant documents) ----------
// Structured metadata only — never file bytes, never public URLs. `storageRef`
// / `fileUrl` stay null until a signed/authenticated private store is connected
// (see src/services/private-documents.ts); nothing is uploaded publicly.
export const documentEntrySchema = z.object({
  id: z.string().min(1, "Document id required"),
  documentCategory: z.string().min(1, "Document category required"),
  documentType: z.string().optional(),
  fileName: z.string().min(1, "File name required"),
  fileSizeBytes: z.number().int().nonnegative(),
  fileType: z.string().optional(),
  storageRef: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  status: z.enum(["recorded", "uploading", "ready", "error"]).optional(),
  uploadedAt: z.string().nullable().optional(),
  verificationStatus: z.enum(["not-verified", "verified"]).optional(),
});

// ---------- Combined schema (shared + type-specific) ----------
export const requestSponsorshipSchema = z.object({
  // Shared fields
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: requiredPhoneSchema,
  organization: z.string().optional(),

  // Consent
  consentGiven: z.literal(true, { message: "Consent required" }),
  antiSpamToken: z.string().nonempty("Anti-spam token required"),

  // Decision point
  requestFor: z.enum(["athlete", "team", "group"], { message: "Select a category" }),

  // Type-specific fields — conditionally revealed in UI; optional at schema level.
  athleteFields: z
    .object({
      athleteName: z.string().min(1, "Fighter name required"),
      dateOfBirth: z
        .string()
        .min(1, "Date of birth required")
        .refine(isValidDateString, { message: "Enter a valid date of birth" })
        .refine((value) => !isFutureDate(value), { message: "Date of birth cannot be in the future" }),
      athleteSport: z.string().min(1, "Sport required"),
      athleteLevel: z.enum(["recreational", "competitive", "professional"]).optional(),
      sponsorshipNeeds: z.string().min(10, "Describe sponsorship needs"),
      sponsorshipPurpose: z.string().min(1, "Purpose of sponsorship"),
      // Fighter-application enrichments. Every field the /apply wizard
      // collects is carried here and persisted by the doc builder — nothing
      // collected on the form is dropped.
      location: z.string().optional(),
      currentRanking: z.string().optional(),
      coach: z.string().optional(),
      academy: z.string().optional(),
      majorAchievements: z.string().optional(),
      upcomingCompetitions: z.string().optional(),
      amountRequested: z.coerce.number().positive("Enter a valid amount").optional(),
      documents: z.array(documentEntrySchema).optional(),
      socialMedia: z
        .object({
          instagram: z.string().optional(),
          facebook: z.string().optional(),
          linkedin: z.string().optional(),
          other: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  teamFields: z
    .object({
      teamName: z.string().min(1, "Team/group name required"),
      teamSport: z.string().min(1, "Sport required"),
      teamLevel: z.enum(["recreational", "competitive", "professional"]),
      sponsorshipNeeds: z.string().min(10, "Describe sponsorship needs"),
      sponsorshipPurpose: z.string().min(1, "Purpose of sponsorship"),
      // Academy / training-center enrichments on the group path. Every field
      // the /apply/academy wizard collects is carried here and persisted by
      // the doc builder — nothing collected on the form is dropped. Kept
      // optional at schema level (generic team/group submissions may omit
      // them); the academy form enforces the required ones at the UI layer.
      // memberCount / establishedYear / coachCount / amountRequested are
      // numbers when the form supplies them.
      location: z.string().optional(),
      memberCount: z.coerce.number().int().positive("Enter a valid member count").optional(),
      establishedYear: z.coerce.number().int().positive("Enter a valid year").optional(),
      contactRole: z.string().optional(),
      coachCount: z.coerce.number().int().positive("Enter a valid coach count").optional(),
      coachesDetails: z.string().optional(),
      achievements: z.string().optional(),
      competitions: z.string().optional(),
      amountRequested: z.coerce.number().positive("Enter a valid amount").optional(),
      documents: z.array(documentEntrySchema).optional(),
      website: z.string().optional(),
      socialMedia: z
        .object({
          instagram: z.string().optional(),
          facebook: z.string().optional(),
          linkedin: z.string().optional(),
          other: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  // Anti-spam / metadata
  formNonce: z.string().optional(),
});

// ---------- Sponsor application schema ----------
// A sponsorship/payment record: every entry commits a positive ₹ amount and
// begins in the `INITIATED` payment status (see features/admin/workflow.ts for
// the payment lifecycle; `PAID`/`FAILED`/`REFUNDED` are server-assigned by the
// future Razorpay pay-gateway adapter, never by browser submissions).
export const sponsorApplicationSchema = z.object({
  organizationName: z.string().min(2, "Organization name required"),
  contactName: z.string().min(2, "Contact name required"),
  email: z.string().email("Valid email required"),
  phone: requiredPhoneSchema,
  website: z.string().url("Valid URL required").optional().or(z.literal("")),
  organizationType: z.enum(["corporate", "nonprofit", "government", "individual", "other"], {
    message: "Select an organization type",
  }),
  sponsorshipLevel: z.enum(["title", "gold", "silver", "bronze", "custom", "unsure"], {
    message: "Select a sponsorship level",
  }),
  amount: z.coerce.number().positive("Enter a valid sponsorship amount"),
  message: z.string().min(10, "Please tell us about your sponsorship interest"),
  consentGiven: z.literal(true, { message: "Consent required" }),
  antiSpamToken: z.string().nonempty("Anti-spam token required"),
  formNonce: z.string().optional(),
});

export type SponsorApplicationFormValues = z.infer<typeof sponsorApplicationSchema>;

// Helper to extract the relevant subset based on decision
export type RequestSponsorshipFormValues = z.infer<typeof requestSponsorshipSchema>;

/** Shared field keys (used by both UI engine + rules) */
export const SHARED_FIELDS = [
  "fullName",
  "email",
  "phone",
  "organization",
  "consentGiven",
  "antiSpamToken",
] as const;

/** ATHLETE-specific field keys */
export const ATHLETE_FIELDS = [
  "requestFor",
  "athleteName",
  "dateOfBirth",
  "athleteSport",
  "athleteLevel",
  "sponsorshipNeeds",
  "sponsorshipPurpose",
  "location",
  "currentRanking",
  "coach",
  "academy",
  "majorAchievements",
  "upcomingCompetitions",
  "amountRequested",
  "documents",
  "socialMedia",
] as const;

/** TEAM/GROUP-specific field keys */
export const TEAM_FIELDS = [
  "requestFor",
  "teamName",
  "teamSport",
  "teamLevel",
  "sponsorshipNeeds",
  "sponsorshipPurpose",
  "location",
  "memberCount",
  "establishedYear",
  "contactRole",
  "coachCount",
  "coachesDetails",
  "achievements",
  "competitions",
  "amountRequested",
  "documents",
  "website",
  "socialMedia",
] as const;
