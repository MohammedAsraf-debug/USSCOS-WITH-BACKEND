/**
 * Public-submission duplicate honesty (false-duplicate regression).
 *
 * Firestore reports a same-nonce rewrite (genuine retry of a confirmed
 * submission) and EVERY other create-denial with the identical
 * `permission-denied` code. writeSubmission must therefore only claim
 * "already submitted successfully" when THIS client previously wrote that
 * formNonce successfully — otherwise it must surface the real denial.
 * Run via the Firestore emulator (skipped when unavailable).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { describe, beforeAll, afterAll, it, expect } from "vitest";
import {
  FirestoreDataAdapter,
  createFormNonce,
} from "@/services/firestore-adapter";
import type { RequestSponsorshipFormValues } from "@/features/sponsorship/schema";

const PROJECT_ID = "usscos-rules-test";
const EMULATOR_HOST = "127.0.0.1:8080";
const RULES = readFileSync(resolve(import.meta.dirname, "../../firestore.rules"), "utf8");

let emulatorAvailable = false;
try {
  const resp = await fetch(`http://${EMULATOR_HOST}/`);
  emulatorAvailable = resp.status !== undefined;
} catch {
  emulatorAvailable = false;
}

let env: RulesTestEnvironment;
beforeAll(async () => {
  if (!emulatorAvailable) return;
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: "127.0.0.1", port: 8080, rules: RULES },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const anonAdapter = () =>
  new FirestoreDataAdapter(env.unauthenticatedContext().firestore() as unknown as Firestore);
const signedInAdapter = () =>
  new FirestoreDataAdapter(
    env.authenticatedContext("test-signed-in-user").firestore() as unknown as Firestore,
  );

function athleteValues(nonce: string): RequestSponsorshipFormValues {
  return {
    requestFor: "athlete",
    fullName: "Arjun R",
    email: "arjun@example.com",
    phone: "9876543210",
    consentGiven: true,
    antiSpamToken: nonce,
    formNonce: nonce,
    athleteFields: {
      athleteName: "Arjun R",
      dateOfBirth: "2002-05-01",
      athleteSport: "Boxing",
      sponsorshipNeeds: "Need support for travel and equipment for nationals",
      sponsorshipPurpose: "Travel and gear for competitions",
      location: "Pune, Maharashtra",
      majorAchievements: "State gold 2024",
      amountRequested: 50000,
      documents: [],
      socialMedia: { instagram: "", facebook: "", linkedin: "", other: "" },
    },
  };
}

function groupValues(nonce: string): RequestSponsorshipFormValues {
  return {
    requestFor: "group",
    fullName: "Rahul M",
    email: "coach@example.com",
    phone: "9876543210",
    organization: "Pune Combat Academy",
    consentGiven: true,
    antiSpamToken: nonce,
    formNonce: nonce,
    teamFields: {
      teamName: "Pune Combat Academy",
      teamSport: "Boxing",
      teamLevel: "competitive",
      sponsorshipNeeds: "Need sparring gear, ring upkeep and travel for athletes",
      sponsorshipPurpose: "Assist athletes with travel and gear",
      memberCount: 45,
      establishedYear: 2015,
      achievements: "State team champions 2024",
      amountRequested: 50000,
      documents: [],
      socialMedia: { instagram: "", facebook: "", linkedin: "", other: "" },
    },
  };
}

describe.skipIf(!emulatorAvailable)("public submission duplicate honesty", () => {
  it("fresh anonymous athlete (/apply) submission succeeds", async () => {
    const nonce = createFormNonce();
    const result = await anonAdapter().submitSponsorshipRequest(athleteValues(nonce));
    expect(result).toEqual({ ok: true, id: nonce });
  });

  it("fresh anonymous group (/apply/academy) submission succeeds", async () => {
    const nonce = createFormNonce();
    const result = await anonAdapter().submitSponsorshipRequest(groupValues(nonce));
    expect(result).toEqual({ ok: true, id: nonce });
  });

  it("same-nonce retry after a confirmed success reports duplicate (no second doc)", async () => {
    const nonce = createFormNonce();
    const adapter = anonAdapter();
    const first = await adapter.submitSponsorshipRequest(athleteValues(nonce));
    expect(first).toEqual({ ok: true, id: nonce });
    const second = await adapter.submitSponsorshipRequest(athleteValues(nonce));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("duplicate");
      expect(second.message).toBe("This form was already submitted successfully.");
    }
  });

  it("fresh signed-in submission denied by the anonymous-create gate surfaces the real error, never duplicate", async () => {
    const nonce = createFormNonce();
    const result = await signedInAdapter().submitSponsorshipRequest(athleteValues(nonce));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(result.message).toBeDefined();
      expect(result.message).not.toContain("already submitted");
    }
  });
});
