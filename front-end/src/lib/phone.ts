import { z } from "zod";

export const MAX_PHONE_LENGTH = 10;

export const PHONE_ERROR = `Enter a valid ${MAX_PHONE_LENGTH}-digit phone number`;

export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, MAX_PHONE_LENGTH);
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  return /^\d{10}$/.test(digits);
}

export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isValidPhone(value), { message: PHONE_ERROR })
  .optional();

export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((value) => isValidPhone(value), { message: PHONE_ERROR });