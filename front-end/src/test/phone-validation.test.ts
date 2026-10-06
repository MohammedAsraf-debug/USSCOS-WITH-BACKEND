import { describe, expect, it } from "vitest";
import {
  isValidPhone,
  PHONE_ERROR,
  MAX_PHONE_LENGTH,
  phoneSchema,
  requiredPhoneSchema,
  sanitizePhoneInput,
} from "@/lib/phone";
import { contactMessageSchema } from "@/features/contact/schema";
import { donationPledgeSchema } from "@/features/donation/schema";
import { requestSponsorshipSchema, sponsorApplicationSchema } from "@/features/sponsorship/schema";

const contactBase = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "9876543210",
  subject: "Sponsorship question",
  message: "I would like to know more about sponsoring a fighter.",
  consentGiven: true,
  antiSpamToken: "tok-test",
};

const donationBase = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "9876543210",
  amount: 500,
  frequency: "one-time",
  consentGiven: true,
  antiSpamToken: "tok-test",
};

const sponsorAppBase = {
  organizationName: "Lovelace Foundation",
  contactName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "9876543210",
  website: "",
  organizationType: "corporate",
  sponsorshipLevel: "custom",
  amount: 500,
  message: "We would like to sponsor fighters for the season.",
  consentGiven: true,
  antiSpamToken: "tok-test",
};

const requestBase = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "9876543210",
  requestFor: "athlete",
  consentGiven: true,
  antiSpamToken: "tok-test",
};

describe("MAX_PHONE_LENGTH", () => {
  it("is 10 digits", () => {
    expect(MAX_PHONE_LENGTH).toBe(10);
  });
});

describe("sanitizePhoneInput", () => {
  it("strips all letters, leaving an empty string", () => {
    expect(sanitizePhoneInput("afeefc")).toBe("");
  });
  it("passes digits through unchanged", () => {
    expect(sanitizePhoneInput("9876543210")).toBe("9876543210");
  });
  it("keeps only digits when letters are mixed in", () => {
    expect(sanitizePhoneInput("987abc654")).toBe("987654");
  });
  it("strips special characters and the plus prefix", () => {
    expect(sanitizePhoneInput("+91 (98765) 432-10")).toBe("9198765432");
  });
  it("caps the result at 10 digits", () => {
    expect(sanitizePhoneInput("12345678901234567890")).toBe("1234567890");
    expect(sanitizePhoneInput("+91 98765 43210")).toBe("9198765432");
  });
});

describe("isValidPhone", () => {
  it("accepts exactly 10 digits", () => {
    expect(isValidPhone("9876543210")).toBe(true);
  });

  it.each([
    "afeefc",
    "abcdefgh",
    "John123",
    "123abc",
    "phone",
    "12@34",
    "987",
    "987654321",
    "98765432101",
    "1234567890123456789",
    "+91 98765 43210",
    "+1 555 123 4567",
    "(91) 98765-4321",
    "+44 20 7946 0958",
    "",
  ])("rejects invalid phone %s", (phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("accepts valid phones", () => {
    expect(phoneSchema.safeParse("9876543210").success).toBe(true);
  });
  it("rejects alphabetic phones with the shared error message", () => {
    const result = phoneSchema.safeParse("not-a-phone");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
  });
  it("rejects a phone with more than 10 digits", () => {
    expect(phoneSchema.safeParse("98765432101").success).toBe(false);
  });
  it("accepts blank and undefined values", () => {
    expect(phoneSchema.safeParse("").success).toBe(true);
    expect(phoneSchema.safeParse(undefined).success).toBe(true);
  });
});

describe("requiredPhoneSchema", () => {
  it("accepts valid phones", () => {
    expect(requiredPhoneSchema.safeParse("9876543210").success).toBe(true);
  });
  it("rejects blank with required error", () => {
    const result = requiredPhoneSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Phone number is required");
    }
  });
  it("rejects undefined with required error", () => {
    const result = requiredPhoneSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
  it("rejects alphabetic phones with the shared error message", () => {
    const result = requiredPhoneSchema.safeParse("not-a-phone");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
  });
});

describe("submit schemas reject invalid phone values", () => {
  it("contactMessageSchema", () => {
    expect(contactMessageSchema.safeParse({ ...contactBase, phone: "9876543210" }).success).toBe(true);
    const result = contactMessageSchema.safeParse({ ...contactBase, phone: "abcdefgh" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
    const noPhone = contactMessageSchema.safeParse({ ...contactBase, phone: undefined });
    expect(noPhone.success).toBe(false);
  });

  it("donationPledgeSchema", () => {
    expect(donationPledgeSchema.safeParse({ ...donationBase, phone: "9876543210" }).success).toBe(true);
    const result = donationPledgeSchema.safeParse({ ...donationBase, phone: "John123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
  });

  it("sponsorApplicationSchema", () => {
    expect(sponsorApplicationSchema.safeParse({ ...sponsorAppBase, phone: "9876543210" }).success).toBe(true);
    const result = sponsorApplicationSchema.safeParse({ ...sponsorAppBase, phone: "phone" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
  });

  it("requestSponsorshipSchema", () => {
    expect(requestSponsorshipSchema.safeParse({ ...requestBase, phone: "9876543210" }).success).toBe(true);
    const result = requestSponsorshipSchema.safeParse({ ...requestBase, phone: "+91 98765 abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PHONE_ERROR);
    }
  });
});