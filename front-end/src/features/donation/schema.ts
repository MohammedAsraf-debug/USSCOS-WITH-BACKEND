/**
 * Public donation pledge schema — validated client-side and again inside
 * the adapter before `donationPledges` is written. Mirrors the M3.3A write
 * contract: consent + anti-spam token + PENDING status (set by the adapter's
 * build step, never by the client).
 */
import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/phone";

export const donationPledgeSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: requiredPhoneSchema,
  amount: z.coerce.number({ message: "Enter a valid amount" }).int("Amount must be a whole number").positive("Enter a valid amount"),
  frequency: z.enum(["one-time", "monthly"], { message: "Choose a frequency" }),
  message: z.string().trim().optional(),
  consentGiven: z.literal(true, { message: "Please consent to be contacted" }),
  antiSpamToken: z.string().nonempty("Anti-spam token required"),
  formNonce: z.string().optional(),
});

export type DonationPledgeFormValues = z.infer<typeof donationPledgeSchema>;