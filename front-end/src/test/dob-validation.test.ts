import { describe, expect, it } from "vitest";
import { isValidDateString, isFutureDate, todayIso } from "@/lib/date";
import { requestSponsorshipSchema } from "@/features/sponsorship/schema";
import { buildSponsorshipRequestDoc } from "@/services/firestore-adapter";

const requestBase = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "9876543210",
  requestFor: "athlete",
  consentGiven: true,
  antiSpamToken: "tok-test",
};

const athleteFields = {
  athleteName: "Ada Lovelace",
  athleteSport: "Boxing",
  athleteLevel: "competitive",
  sponsorshipNeeds: "Funding for training, gear, travel, and competition fees.",
  sponsorshipPurpose: "National-level preparation",
};

function build(dob?: string) {
  const fields = { ...athleteFields };
  if (dob !== undefined) fields.dateOfBirth = dob;
  return { ...requestBase, athleteFields: fields };
}

describe("isValidDateString", () => {
  it.each(["2004-03-12", "1999-12-31", "2024-02-29"])("accepts %s", (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each(["2023-02-29", "2025-13-01", "2025-00-10", "2004/03/12", "12-03-2004", "not-a-date", ""])(
    "rejects %s",
    (value) => {
      expect(isValidDateString(value)).toBe(false);
    },
  );
});

describe("isFutureDate", () => {
  it("returns false for a past date", () => {
    expect(isFutureDate("2000-01-01")).toBe(false);
  });

  it("returns true for a future date", () => {
    expect(isFutureDate("2099-01-01")).toBe(true);
  });

  it("returns false for a malformed value", () => {
    expect(isFutureDate("not-a-date")).toBe(false);
  });
});

describe("todayIso", () => {
  it("produces a YYYY-MM-DD date that is valid and not in the future", () => {
    const value = todayIso();
    expect(isValidDateString(value)).toBe(true);
    expect(isFutureDate(value)).toBe(false);
  });
});

describe("requestSponsorshipSchema dateOfBirth", () => {
  it("requires dateOfBirth", () => {
    const result = requestSponsorshipSchema.safeParse(build());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
        "athleteFields.dateOfBirth",
      );
    }
  });

  it("accepts a valid past date of birth", () => {
    expect(requestSponsorshipSchema.safeParse(build("2004-03-12")).success).toBe(true);
  });

  it("rejects a future date of birth", () => {
    const result = requestSponsorshipSchema.safeParse(build("2099-01-01"));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (error) => error.path.join(".") === "athleteFields.dateOfBirth",
      );
      expect(issue?.message).toBe("Date of birth cannot be in the future");
    }
  });

  it("rejects a malformed date of birth", () => {
    const result = requestSponsorshipSchema.safeParse(build("12-03-2004"));
    expect(result.success).toBe(false);
  });
});

describe("dateOfBirth persistence in the Firestore application record", () => {
  it("rejects a valid past DOB when the athlete fields omit it", () => {
    expect(requestSponsorshipSchema.safeParse(build()).success).toBe(false);
  });

  it("writes the selected past DOB into the saved application document", () => {
    const doc = buildSponsorshipRequestDoc(build("2004-03-12"));
    expect(doc.dateOfBirth).toBe("2004-03-12");
  });

  it("writes the DOB alongside the athlete identity fields", () => {
    const doc = buildSponsorshipRequestDoc(build("1999-12-31"));
    expect(doc).toMatchObject({
      type: "athlete",
      fullName: "Ada Lovelace",
      sport: "Boxing",
      level: "competitive",
      dateOfBirth: "1999-12-31",
    });
  });
});