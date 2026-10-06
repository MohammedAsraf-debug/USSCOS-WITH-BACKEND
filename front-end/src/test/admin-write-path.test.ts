/**
 * Diagnostic: exercise the exact payloads the admin pages build through the
 * shared write path validation (`adminWrite` → CATALOGUE_SCHEMAS.safeParse).
 *
 * This mirrors AdminAthletes/AdminGroups/AdminEvents/AdminPartners handleSave.
 * A failure here means the adapter rejects BEFORE any Firestore write, with
 * reason "invalid", so the real Firebase error never surfaces.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE_SCHEMAS, omitUndefinedValues } from "@/features/admin/catalogue";

describe("shared admin write path — page payload validation", () => {
  it("athlete create payload from AdminAthletes.handleSave", () => {
    const payload = {
      fullName: "Jane Doe",
      sport: "Boxing",
      level: "combat sports", // from category free-text input
      biography: null,
      profileImageUrl: null,
    };
    const r = CATALOGUE_SCHEMAS.athletes.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("athlete create payload with empty level/biography (form default)", () => {
    const payload = {
      fullName: "Jane Doe",
      sport: "Boxing",
      level: null,
      biography: null,
      profileImageUrl: "https://example.com/a.jpg",
    };
    const r = CATALOGUE_SCHEMAS.athletes.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("group create payload from AdminGroups.handleSave", () => {
    const payload = {
      groupName: "Westside Boxing Club",
      groupType: "club",
      location: "Mumbai",
      memberCount: 45,
      description: "A boxing club",
      website: "",
      profileImageUrl: "https://example.com/g.jpg",
    };
    const r = CATALOGUE_SCHEMAS.groups.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("event create payload from AdminEvents.handleSave", () => {
    const payload = {
      title: "City Open 2026",
      type: "informational",
      status: "upcoming",
      date: "2026-09-20",
      time: undefined,
      endTime: undefined,
      location: "Mumbai",
      description: "Event description",
      coverImageUrl: "https://example.com/e.jpg",
      registrationUrl: "",
      registrationNote: undefined,
    };
    const r = CATALOGUE_SCHEMAS.events.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("partner create payload from AdminPartners.handleSave", () => {
    const payload = {
      name: "Acme Sports",
      type: "sponsor",
      category: undefined,
      logoUrl: "https://example.com/p.jpg",
      website: "",
    };
    const r = CATALOGUE_SCHEMAS.partners.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("story create payload from AdminNews.handleSave", () => {
    const payload = {
      title: "New Story",
      author: "Editor",
      excerpt: "An excerpt",
      body: "Body text",
      coverImageUrl: "https://example.com/s.jpg",
    };
    const r = CATALOGUE_SCHEMAS.stories.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it("gallery image create payload from AdminGallery.handleSave", () => {
    const payload = {
      title: "Photo",
      altText: "A photo",
      category: "events",
      publicUrl: "https://example.com/x.jpg",
    };
    const r = CATALOGUE_SCHEMAS.galleryImages.safeParse(payload);
    expect(r.success).toBe(true);
  });
});

describe("omitUndefinedValues — optional event fields never written as undefined", () => {
  it("omits only undefined values; keeps null / empty-string blanks (schema-approved)", () => {
    const input = {
      title: "State Open 2026",
      time: undefined,
      endTime: undefined,
      location: null,
      description: "",
      registrationUrl: "",
      registrationNote: undefined,
      seoTitle: undefined,
    };
    const out = omitUndefinedValues(input);
    expect(out).toEqual({
      title: "State Open 2026",
      location: null,
      description: "",
      registrationUrl: "",
    });
  });

  it("leaves a reset document with no undefined values (Firestore-safe)", () => {
    const out = omitUndefinedValues({
      title: "State Open 2026",
      time: "",
      endTime: "01:00 PM",
      description: "Full details",
    });
    expect(Object.values(out).includes(undefined)).toBe(false);
    expect(out.endTime).toBe("01:00 PM");
  });

  it("event create payload with empty End Time still passes the schema after stripping", () => {
    const payload = {
      title: "City Open 2026",
      type: "informational",
      status: "upcoming",
      date: "2026-09-20",
      time: undefined,
      endTime: undefined,
      location: "Mumbai",
      description: "Event description",
      coverImageUrl: "https://example.com/e.jpg",
      registrationUrl: "",
      registrationNote: undefined,
    };
    expect(CATALOGUE_SCHEMAS.events.safeParse(omitUndefinedValues(payload)).success).toBe(true);
  });

  it("does not mutate the input payload", () => {
    const input = { endTime: undefined, title: "T" };
    const out = omitUndefinedValues(input);
    expect(Object.keys(input)).toContain("endTime");
    expect(Object.keys(out)).not.toContain("endTime");
  });
});