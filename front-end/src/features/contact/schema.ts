/**
 * Public contact form schema (M3.3B) — validated client-side and again inside
 * the adapter before `contactMessages` is written. Mirrors the M3.3A write
 * contract: consent + anti-spam token + PENDING status (set by the adapter's
 * build step, never by the client).
 */
import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/phone";

const email = z.string().trim().email("Enter a valid email address");

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email,
  phone: requiredPhoneSchema,
  subject: z.string().trim().min(2, "Enter a subject"),
  message: z.string().trim().min(10, "Please include a message (at least 10 characters)"),
  consentGiven: z.literal(true, { message: "Please consent to be contacted" }),
  antiSpamToken: z.string().nonempty("Anti-spam token required"),
  formNonce: z.string().optional(),
});

export type ContactMessageFormValues = z.infer<typeof contactMessageSchema>;