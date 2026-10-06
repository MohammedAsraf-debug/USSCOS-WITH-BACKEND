/**
 * Firestore security-rules test (M3.3A contract).
 *
 * Verifies that the deployed/repo ruleset grants SUPER_ADMIN full CRUD on the
 * admin catalogue collections (athletes, groups, events, stories,
 * galleryImages, partners, sponsorshipRequests, sponsorApplications,
 * contactMessages, donationPledges, contentBlocks) and that anonymous/public
 * writes are still rejected where the contract demands it. Run via the
 * Firestore emulator.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { describe, beforeAll, afterAll, it } from "vitest";

const PROJECT_ID = "usscos-rules-test";
const SUPER_ADMIN_UID = "oOTxeX3FBoWVEKIA1mRxqYDpIff1";
const ADMIN_UID = "admin-user-001";
const CM_UID = "cm-user-001";
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
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: RULES,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

async function seedUsers() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("users").doc(SUPER_ADMIN_UID).set({
      role: "SUPER_ADMIN",
      status: "active",
      email: "ationic.it@gmail.com",
    });
    await db.collection("users").doc(CM_UID).set({
      role: "CONTENT_MANAGER",
      status: "active",
      email: "cm@usscos.org",
    });
    await db.collection("users").doc(ADMIN_UID).set({
      role: "ADMIN",
      status: "active",
      email: "admin@usscos.org",
    });
  });
}

async function seedExisting(col: string): Promise<string> {
  let id = "";
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = await ctx.firestore().collection(col).add({ seeded: true, status: "PENDING" });
    id = ref.id;
  });
  return id;
}

// Production formNonce is crypto.randomUUID() — a fresh value per submission.
// Deterministic-ID tests therefore derive a NEW nonce each run so re-running
// the suite against the same (persistent) emulator never hits a path that a
// prior run already created (which Firestore would demote to a denied UPDATE).
function freshNonce(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
}

const sa = () => env.authenticatedContext(SUPER_ADMIN_UID, {
  email: "ationic.it@gmail.com",
  email_verified: true,
});
const anon = () => env.unauthenticatedContext();

describe.skipIf(!emulatorAvailable)("SUPER_ADMIN admin catalogue CRUD against deployed rules", () => {
  beforeAll(async () => {
    await seedUsers();
  });

  it("create athlete (approvalStatus=draft) succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("athletes").add({
        fullName: "Test Athlete",
        sport: "Boxing",
        approvalStatus: "draft",
      }),
    );
  });

  it("create athlete with non-draft approvalStatus is rejected", async () => {
    const db = sa().firestore();
    await assertFails(
      db.collection("athletes").add({
        fullName: "Test Athlete",
        sport: "Boxing",
        approvalStatus: "approved",
      }),
    );
  });

  it("create group (approvalStatus=draft) succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("groups").add({
        groupName: "Test Club",
        groupType: "club",
        approvalStatus: "draft",
      }),
    );
  });

  it("create event succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("events").add({
        title: "Test Event",
        type: "informational",
        status: "upcoming",
        date: "2026-09-20",
      }),
    );
  });

  it("create story (published=false) succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("stories").add({
        title: "Test Story",
        body: "Body",
        published: false,
      }),
    );
  });

  it("create story (published=true) is rejected by rules", async () => {
    const db = sa().firestore();
    await assertFails(
      db.collection("stories").add({
        title: "Test Story",
        published: true,
      }),
    );
  });

  it("create galleryImage succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("galleryImages").add({
        title: "Test Photo",
        altText: "A photo",
        category: "Events",
        publicUrl: "https://example.com/a.jpg",
      }),
    );
  });

  it("create partner (active=false) succeeds", async () => {
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("partners").add({
        name: "Acme Sports",
        type: "sponsor",
        active: false,
      }),
    );
  });

  it("create partner (active=true) is rejected by rules", async () => {
    const db = sa().firestore();
    await assertFails(
      db.collection("partners").add({
        name: "Acme Sports",
        type: "sponsor",
        active: true,
      }),
    );
  });

  it("update athlete as SUPER_ADMIN succeeds", async () => {
    const id = await seedExisting("athletes");
    const db = sa().firestore();
    await assertSucceeds(db.collection("athletes").doc(id).update({ fullName: "Renamed" }));
  });

  it("SUPER_ADMIN workflow: approve athlete (approvalStatus draft->approved) + audit entry", async () => {
    const id = await seedExisting("athletes");
    const db = sa().firestore();
    // Exactly what runWorkflowTransition applies atomically:
    await assertSucceeds(
      db.collection("athletes").doc(id).update({
        approvalStatus: "approved",
        updatedAt: "2026-09-05T00:00:00.000Z",
      }),
    );
    await assertSucceeds(
      db.collection("auditLogs").add({
        entityKind: "athlete",
        entityId: id,
        action: "APPROVE",
        byUid: SUPER_ADMIN_UID,
        byEmail: "ationic.it@gmail.com",
        before: "draft",
        after: "approved",
        note: null,
        createdAt: "2026-09-05T00:00:00.000Z",
      }),
    );
  });

  it("CONTENT_MANAGER cannot approve (approvalStatus change denied by rules)", async () => {
    const id = await seedExisting("athletes");
    const db = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertFails(
      db.collection("athletes").doc(id).update({ approvalStatus: "approved" }),
    );
  });

  it("update event as SUPER_ADMIN succeeds", async () => {
    const id = await seedExisting("events");
    const db = sa().firestore();
    await assertSucceeds(db.collection("events").doc(id).update({ title: "Updated" }));
  });

  it("delete partner as SUPER_ADMIN succeeds", async () => {
    const id = await seedExisting("partners");
    const db = sa().firestore();
    await assertSucceeds(db.collection("partners").doc(id).delete());
  });

  it("delete group as SUPER_ADMIN succeeds", async () => {
    const id = await seedExisting("groups");
    const db = sa().firestore();
    await assertSucceeds(db.collection("groups").doc(id).delete());
  });

  it("SUPER_ADMIN can read a draft athlete doc", async () => {
    const id = await seedExisting("athletes");
    const db = sa().firestore();
    await assertSucceeds(db.collection("athletes").doc(id).get());
  });

  it("SUPER_ADMIN list returns draft athletes", async () => {
    const db = sa().firestore();
    const snap = await db.collection("athletes").get();
    const drafts = snap.docs.filter((d) => d.data().approvalStatus === "draft");
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("anonymous cannot read a draft athlete doc", async () => {
    const id = await seedExisting("athletes");
    await assertFails(anon().firestore().collection("athletes").doc(id).get());
  });

  it("SUPER_ADMIN can read unpublished story, inactive partner, draft event", async () => {
    const db = sa().firestore();
    const storyId = await seedExisting("stories");
    const partnerId = await seedExisting("partners");
    const eventId = await seedExisting("events");
    await assertSucceeds(db.collection("stories").doc(storyId).get());
    await assertSucceeds(db.collection("partners").doc(partnerId).get());
    await assertSucceeds(db.collection("events").doc(eventId).get());
  });

  it("CONTENT_MANAGER cannot delete (SUPER_ADMIN-only rules)", async () => {
    const id = await seedExisting("groups");
    const db = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertFails(db.collection("groups").doc(id).delete());
  });

  it("anonymous public-form write to sponsorshipRequests is rejected (no token/consent/shape)", async () => {
    const db = anon().firestore();
    await assertFails(db.collection("sponsorshipRequests").add({ status: "PENDING", email: "x@y.com" }));
  });

  it("anonymous public-form write with full M3.3B shape succeeds", async () => {
    const db = anon().firestore();
    await assertSucceeds(
      db.collection("sponsorshipRequests").add({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        contactPerson: "Jane Doe",
        email: "jane@example.com",
      }),
    );
  });

  it("anonymous deterministic-ID CREATE of sponsorshipRequests/{formNonce} (PRODUCTION path: doc ID == formNonce) succeeds", async () => {
    const db = anon().firestore();
    const nonce = freshNonce("nonce-prod");
    await assertSucceeds(
      db.collection("sponsorshipRequests").doc(nonce).set({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: nonce,
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        antiSpamTokenSize: nonce.length,
      }),
    );
  });

  it("anonymous deterministic-ID CREATE with same formNonce (existing path → UPDATE denied by rules) is rejected — never a second doc", async () => {
    const db = anon().firestore();
    const nonce = freshNonce("nonce-prod");
    // First create at the deterministic path succeeds.
    await assertSucceeds(
      db.collection("sponsorshipRequests").doc(nonce).set({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: nonce,
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        antiSpamTokenSize: nonce.length,
      }),
    );
    // Reusing the same formNonce targets the same path; Firestore treats it as
    // an UPDATE of the existing doc, which the rules deny for anonymous clients.
    await assertFails(
      db.collection("sponsorshipRequests").doc(nonce).set({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: nonce,
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        antiSpamTokenSize: nonce.length,
      }),
    );
  });

  it("anonymous deterministic-ID CREATE of sponsorApplications/{formNonce} (academy PRODUCTION path) succeeds", async () => {
    const db = anon().firestore();
    await assertSucceeds(
      db.collection("sponsorApplications").doc("academy-nonce-581c").set({
        status: "PENDING",
        paymentStatus: "INITIATED",
        paymentProvider: "razorpay",
        currency: "INR",
        amount: 50000,
        consentGiven: true,
        antiSpamToken: "academy-nonce-581c",
        paymentStatusInitiated: true,
        academyName: "USSCOS Elite Academy",
        contactPerson: "Academy Director",
        email: "academy@example.com",
      }),
    );
  });

  it("anonymous cannot READ an existing sponsorshipRequests/{formNonce} doc (rules keep public reads staff-only)", async () => {
    const db = anon().firestore();
    const nonce = "nonce-prod-2111c";
    await assertSucceeds(
      db.collection("sponsorshipRequests").doc(nonce).set({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: nonce,
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        antiSpamTokenSize: nonce.length,
      }),
    );
    await assertFails(db.collection("sponsorshipRequests").doc(nonce).get());
  });

  it("anonymous UPDATE/DELETE of an existing sponsorshipRequests/{formNonce} doc is rejected", async () => {
    const db = anon().firestore();
    const nonce = "nonce-prod-2111d";
    await assertSucceeds(
      db.collection("sponsorshipRequests").doc(nonce).set({
        type: "athlete",
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: nonce,
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        antiSpamTokenSize: nonce.length,
      }),
    );
    await assertFails(
      db.collection("sponsorshipRequests").doc(nonce).update({ status: "REVIEWING" }),
    );
    await assertFails(db.collection("sponsorshipRequests").doc(nonce).delete());
  });

  it("anonymous donation pledge with full M3.3B shape succeeds", async () => {
    const db = anon().firestore();
    await assertSucceeds(
      db.collection("donationPledges").add({
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        donorName: "Jane Doe",
        email: "jane@example.com",
        amount: 5000,
        frequency: "one-time",
      }),
    );
  });

  it("anonymous donation pledge missing consent/token is rejected", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("donationPledges").add({ status: "PENDING", amount: 5000 }),
    );
  });

  it("anonymous cannot read or update donation pledge", async () => {
    const db = anon().firestore();
    const id = await seedExisting("donationPledges");
    await assertFails(db.collection("donationPledges").doc(id).get());
    await assertFails(
      db.collection("donationPledges").doc(id).update({ status: "APPROVED" }),
    );
  });

  it("SUPER_ADMIN can read and update donation pledge", async () => {
    const id = await seedExisting("donationPledges");
    const db = sa().firestore();
    await assertSucceeds(db.collection("donationPledges").doc(id).get());
    await assertSucceeds(
      db.collection("donationPledges").doc(id).update({ status: "RECORDED" }),
    );
  });

  it("anonymous can read a content block", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("contentBlocks").doc("homepage").set({
        heroEyebrow: "Empowering Fighters & Combat Athletes",
      });
    });
    const db = anon().firestore();
    await assertSucceeds(db.collection("contentBlocks").doc("homepage").get());
  });

  it("anonymous cannot create or update a content block", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("contentBlocks").doc("homepage").set({ heroEyebrow: "Hacked" }),
    );
  });

  it("SUPER_ADMIN and CONTENT_MANAGER can upsert a content block", async () => {
    const saDb = sa().firestore();
    await assertSucceeds(
      saDb.collection("contentBlocks").doc("about").set({ intro: "Edited about text" }),
    );
    const cmDb = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertSucceeds(
      cmDb.collection("contentBlocks").doc("about").set({ intro: "CM edited text" }),
    );
  });

  it("CONTENT_MANAGER cannot delete a content block (SUPER_ADMIN only)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("contentBlocks").doc("about").set({ intro: "seed" });
    });
    const cmDb = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertFails(cmDb.collection("contentBlocks").doc("about").delete());
    await assertSucceeds(sa().firestore().collection("contentBlocks").doc("about").delete());
  });
});

describe.skipIf(!emulatorAvailable)("Sponsorship APPLICATION workflow against deployed rules", () => {
  beforeAll(async () => {
    await seedUsers();
  });

  it("anonymous public-form create with the EXACT SponsorRequest payload (buildSponsorApplicationDoc + athleteRef) succeeds", async () => {
    const db = anon().firestore();
    await assertSucceeds(
      db.collection("sponsorApplications").add({
        status: "PENDING",
        paymentStatus: "INITIATED",
        paymentProvider: "razorpay",
        currency: "INR",
        amount: 25000,
        consentGiven: true,
        antiSpamToken: "web-submit",
        interestType: "individual",
        orgName: "Acme Sponsor Corp",
        contactName: "Jane Doe",
        email: "jane@example.com",
        phone: "+91 98765 43210",
        website: null,
        supportKind: "custom",
        message: "Athlete: Mohammed Asraf (oluXyV9x1uU5p2IBdzF9). Type: Equipment. Supporting training equipment.",
        formNonce: "c96eaaaa-0000-4000-8000-000000000000",
        createdAt: "2026-09-07T08:00:00.000Z",
        updatedAt: "2026-09-07T08:00:00.000Z",
        athleteRef: {
          id: "oluXyV9x1uU5p2IBdzF9",
          name: "Mohammed Asraf",
          sport: "Combat",
        },
      }),
    );
  });

  it("anonymous create with paymentStatus PAID is rejected (payment lifecycle is server-side)", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("sponsorApplications").add({
        status: "PENDING",
        paymentStatus: "PAID",
        paymentProvider: "razorpay",
        currency: "INR",
        amount: 25000,
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        contactName: "Jane Doe",
        email: "jane@example.com",
      }),
    );
  });

  it("anonymous create without an amount is rejected (amount required)", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("sponsorApplications").add({
        status: "PENDING",
        paymentStatus: "INITIATED",
        paymentProvider: "razorpay",
        currency: "INR",
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        contactName: "Jane Doe",
        email: "jane@example.com",
      }),
    );
  });

  it("anonymous create with amount as a string is rejected (must be numeric)", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("sponsorApplications").add({
        status: "PENDING",
        paymentStatus: "INITIATED",
        paymentProvider: "razorpay",
        currency: "INR",
        amount: "25000",
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        contactName: "Jane Doe",
        email: "jane@example.com",
      }),
    );
  });

  it("anonymous create with a forged paymentId/orderId is rejected (server-assigned fields)", async () => {
    const db = anon().firestore();
    await assertFails(
      db.collection("sponsorApplications").add({
        status: "PENDING",
        paymentStatus: "INITIATED",
        paymentProvider: "razorpay",
        currency: "INR",
        amount: 25000,
        consentGiven: true,
        antiSpamToken: "nonce-abc",
        contactName: "Jane Doe",
        email: "jane@example.com",
        paymentId: "pay_forged",
      }),
    );
  });

  it("anonymous cannot read, update (incl. to PAID) or delete a sponsor application", async () => {
    const id = await seedExisting("sponsorApplications");
    const db = anon().firestore();
    await assertFails(db.collection("sponsorApplications").doc(id).get());
    await assertFails(db.collection("sponsorApplications").doc(id).update({ paymentStatus: "PAID" }));
    await assertFails(db.collection("sponsorApplications").doc(id).delete());
  });

  it("SUPER_ADMIN can read a sponsor application and update status + payment lifecycle fields", async () => {
    const id = await seedExisting("sponsorApplications");
    const db = sa().firestore();
    await assertSucceeds(db.collection("sponsorApplications").doc(id).get());
    await assertSucceeds(
      db.collection("sponsorApplications").doc(id).update({
        status: "REVIEWING",
        paymentStatus: "PAID",
        paymentId: "pay_Xyz",
        orderId: "order_Abc",
        updatedAt: "2026-09-05T00:00:00.000Z",
      }),
    );
    await assertSucceeds(
      db.collection("auditLogs").add({
        entityKind: "sponsorApplication",
        entityId: id,
        action: "PAYMENT_PAID",
        byUid: SUPER_ADMIN_UID,
        byEmail: "ationic.it@gmail.com",
        before: "INITIATED",
        after: "PAID",
        createdAt: "2026-09-05T00:00:00.000Z",
      }),
    );
  });

  it("CONTENT_MANAGER cannot change a sponsor application status", async () => {
    const id = await seedExisting("sponsorApplications");
    const db = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertFails(db.collection("sponsorApplications").doc(id).update({ status: "REVIEWING" }));
    await assertFails(db.collection("sponsorApplications").doc(id).update({ paymentStatus: "PAID" }));
  });

  it("SUPER_ADMIN can reject then reopen a sponsor application (REJECTED → PENDING)", async () => {
    const id = await seedExisting("sponsorApplications");
    const db = sa().firestore();
    await assertSucceeds(
      db.collection("sponsorApplications").doc(id).update({
        status: "REJECTED",
        reason: "Out of scope",
        processedBy: SUPER_ADMIN_UID,
      }),
    );
    await assertSucceeds(
      db.collection("sponsorApplications").doc(id).update({ status: "PENDING" }),
    );
  });

  it("SUPER_ADMIN can delete a sponsor application (admin-only)", async () => {
    const id = await seedExisting("sponsorApplications");
    const db = sa().firestore();
    await assertSucceeds(db.collection("sponsorApplications").doc(id).delete());
  });

  it("SUPER_ADMIN can read confirmed records from the sponsorships collection", async () => {
    const id = await seedExisting("sponsorships");
    await assertSucceeds(sa().firestore().collection("sponsorships").doc(id).get());
  });

  // ----- paymentRecords ledger (server-owned; PHASE 20) -----

  it("anonymous cannot read or write the paymentRecords ledger", async () => {
    const id = await seedExisting("paymentRecords");
    const db = anon().firestore();
    await assertFails(db.collection("paymentRecords").doc(id).get());
    await assertFails(
      db.collection("paymentRecords").doc(id).set({
        purpose: "DONATION",
        paymentStatus: "PAID",
        amount: 500,
        currency: "INR",
      }),
    );
    await assertFails(db.collection("paymentRecords").doc(id).update({ paymentStatus: "PAID" }));
    await assertFails(db.collection("paymentRecords").doc(id).delete());
  });

  it("SUPER_ADMIN can read a payment record", async () => {
    const id = await seedExisting("paymentRecords");
    await assertSucceeds(sa().firestore().collection("paymentRecords").doc(id).get());
  });

  it("ADMIN can read a payment record", async () => {
    const id = await seedExisting("paymentRecords");
    const db = env.authenticatedContext(ADMIN_UID, { email: "admin@usscos.org" }).firestore();
    await assertSucceeds(db.collection("paymentRecords").doc(id).get());
  });

  it("CONTENT_MANAGER cannot read the paymentRecords ledger", async () => {
    const id = await seedExisting("paymentRecords");
    const db = env.authenticatedContext(CM_UID, { email: "cm@usscos.org" }).firestore();
    await assertFails(db.collection("paymentRecords").doc(id).get());
  });

  it("SUPER_ADMIN cannot write the paymentRecords ledger (server-owned only)", async () => {
    const db = sa().firestore();
    await assertFails(
      db.collection("paymentRecords").add({
        purpose: "DONATION",
        paymentStatus: "PAID",
        amount: 500,
        currency: "INR",
      }),
    );
  });
});

describe.skipIf(!emulatorAvailable)("Phase 8 — data integrity matrix", () => {
  beforeAll(async () => {
    await seedUsers();
  });

  const cm = () => env.authenticatedContext(CM_UID, { email: "cm@usscos.org" });
  const admin = () => env.authenticatedContext(ADMIN_UID, { email: "admin@usscos.org" });
  const asUid = (uid: string) => env.authenticatedContext(uid);
  const freshUid = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  async function seedUserDoc(uid: string, data: Record<string, unknown>): Promise<void> {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("users").doc(uid).set(data);
    });
  }

  // ----- users/{uid}: role authority hardening -----
  it("anonymous cannot read any users document", async () => {
    await assertFails(anon().firestore().collection("users").doc(SUPER_ADMIN_UID).get());
  });

  it("authenticated user can read their OWN users document (bootstrap exception)", async () => {
    const uid = freshUid("member");
    await seedUserDoc(uid, { role: "CONTENT_MANAGER", status: "active" });
    await assertSucceeds(asUid(uid).firestore().collection("users").doc(uid).get());
  });

  it("non-staff authenticated user cannot read ANOTHER users document", async () => {    // Staff may read any user doc by design (bootstrap + administration), so
    // the meaningful IDOR case is a non-staff identity (e.g. an applicant
    // with no users record at all) probing someone else's document.
    const a = freshUid("outsider-a");
    const b = freshUid("member-b");
    await seedUserDoc(b, { role: "ADMIN", status: "active" });
    await assertFails(asUid(a).firestore().collection("users").doc(b).get());
  });

  it("staff can read any users document (intentional: bootstrap + administration)", async () => {
    const b = freshUid("member-b2");
    await seedUserDoc(b, { role: "ADMIN", status: "active" });
    await assertSucceeds(cm().firestore().collection("users").doc(b).get());
  });

  it("ADMIN cannot self-promote via users update", async () => {
    await assertFails(
      admin().firestore().collection("users").doc(ADMIN_UID).update({ role: "SUPER_ADMIN" }),
    );
  });

  it("CONTENT_MANAGER cannot create users documents", async () => {
    await assertFails(
      cm().firestore().collection("users").doc(freshUid("planted")).set({ role: "ADMIN", status: "active" }),
    );
  });

  it("SUPER_ADMIN can create and update users documents (role management)", async () => {
    const uid = freshUid("managed");
    const db = sa().firestore();
    await assertSucceeds(db.collection("users").doc(uid).set({ role: "ADMIN", status: "active" }));
    await assertSucceeds(db.collection("users").doc(uid).update({ status: "suspended" }));
  });

  it("users documents can never be hard-deleted, not even by SUPER_ADMIN", async () => {
    const uid = freshUid("nodelete");
    await seedUserDoc(uid, { role: "ADMIN", status: "active" });
    await assertFails(sa().firestore().collection("users").doc(uid).delete());
    await assertFails(admin().firestore().collection("users").doc(uid).delete());
  });

  // ----- CONTENT_MANAGER field-injection hardening -----
  it("CONTENT_MANAGER update mixing allowed + forbidden athlete fields is rejected wholesale", async () => {
    const id = await seedExisting("athletes");
    await assertFails(
      cm().firestore().collection("athletes").doc(id).update({
        biography: "Updated bio",
        approvalStatus: "approved",
      }),
    );
  });

  it("CONTENT_MANAGER cannot set athlete featured flag", async () => {
    const id = await seedExisting("athletes");
    await assertFails(cm().firestore().collection("athletes").doc(id).update({ featured: true }));
  });

  it("CONTENT_MANAGER can still update allowlisted athlete copy", async () => {
    const id = await seedExisting("athletes");
    await assertSucceeds(cm().firestore().collection("athletes").doc(id).update({ biography: "CM edit" }));
  });

  // ----- lesser-covered collections -----
  it("anonymous cannot create gallery images", async () => {
    await assertFails(
      anon().firestore().collection("galleryImages").add({ title: "X", altText: "Y", category: "Z" }),
    );
  });

  it("CONTENT_MANAGER cannot delete gallery images", async () => {
    const id = await seedExisting("galleryImages");
    await assertFails(cm().firestore().collection("galleryImages").doc(id).delete());
  });

  it("CONTENT_MANAGER cannot publish opportunities (status open denied)", async () => {
    const id = await seedExisting("opportunities");
    await assertFails(cm().firestore().collection("opportunities").doc(id).update({ status: "open" }));
  });

  it("ADMIN cannot write legal siteSettings keys (privacy/terms)", async () => {
    await assertFails(admin().firestore().collection("siteSettings").doc("privacy").set({ text: "Hacked" }));
  });

  it("CONTENT_MANAGER cannot write siteSettings at all", async () => {
    await assertFails(cm().firestore().collection("siteSettings").doc("homepage").set({ hero: "Hi" }));
  });

  it("CONTENT_MANAGER cannot write the paymentRecords ledger", async () => {
    await assertFails(
      cm().firestore().collection("paymentRecords").add({ purpose: "DONATION", paymentStatus: "PAID" }),
    );
  });

  it("anonymous contact-message create succeeds only with the full shape", async () => {
    const db = anon().firestore();
    await assertSucceeds(
      db.collection("contactMessages").add({
        status: "PENDING",
        consentGiven: true,
        antiSpamToken: freshNonce("tok"),
        name: "Jane",
        email: "jane@example.com",
        subject: "Hello",
        message: "Test message",
        formNonce: freshNonce("nonce"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    await assertFails(db.collection("contactMessages").add({ status: "PENDING" }));
  });

  it("anonymous cannot read contact messages", async () => {
    const id = await seedExisting("contactMessages");
    await assertFails(anon().firestore().collection("contactMessages").doc(id).get());
  });

  it("dormant sponsorships collection stays staff-gated for anonymous reads", async () => {
    const id = await seedExisting("sponsorships");
    await assertFails(anon().firestore().collection("sponsorships").doc(id).get());
  });

  it("CONTENT_MANAGER cannot touch sponsorship contactInfo/adminNotes", async () => {
    const id = await seedExisting("sponsorships");
    await assertFails(
      cm().firestore().collection("sponsorships").doc(id).update({ contactInfo: "attacker@example.com" }),
    );
  });

  it("audit log entries are append-only and self-attributed", async () => {
    const db = cm().firestore();
    await assertSucceeds(
      db.collection("auditLogs").add({
        entityKind: "athlete",
        entityId: "x",
        action: "EDIT",
        byUid: CM_UID,
        createdAt: new Date().toISOString(),
      }),
    );
    const id = await seedExisting("auditLogs");
    await assertFails(sa().firestore().collection("auditLogs").doc(id).update({ action: "REWRITE" }));
    await assertFails(sa().firestore().collection("auditLogs").doc(id).delete());
  });
});