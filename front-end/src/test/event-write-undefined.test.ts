/**
 * Admin Events create/update write path — optional empty fields (e.g. an
 * Event End Time left blank) must NEVER be written to Firestore as
 * `undefined`. `addDoc`/`updateDoc` reject undefined ("Unsupported field
 * value: undefined"), which is the reported admin bug. The adapter strips
 * undefined from event writes before `adminWrite`, so blank optional fields
 * are simply omitted from the document (`null`/`""` blanks are preserved).
 *
 * The Firestore driver is mocked; the real `FirestoreDataAdapter.createEvent`
 * / `updateEvent` methods run end-to-end, and the exact document argument
 * handed to `addDoc`/`updateDoc` is asserted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDoc, updateDoc } from "firebase/firestore";
import { FirestoreDataAdapter } from "@/services/firestore-adapter";
import type { EventWrite } from "@/features/admin/catalogue";

vi.mock("@/services/firebase", () => ({
  ensureInitialized: () => true,
  firebaseEnabled: true,
  getFirestoreInstance: () => ({ __fake: true }),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(async () => ({ id: "ev-generated" })),
  updateDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  collection: vi.fn((_fs: unknown, col: string) => ({ __type: "collection", col })),
  doc: vi.fn((_fs: unknown, _col: string, id: string) => ({ __type: "doc", id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
}));

const SUPER_ADMIN = { role: "SUPER_ADMIN" as const };
const adapter = new FirestoreDataAdapter({ __fake: true } as never);

/** Mirrors AdminEvents.handleSave with the optional fields left blank. */
const emptyOptionalFields: EventWrite = {
  title: "City Open 2026",
  type: "informational",
  status: "upcoming",
  date: "2026-09-20",
  time: undefined,
  endTime: undefined,
  location: "Mumbai",
  description: "",
  coverImageUrl: "https://example.com/e.jpg",
  registrationUrl: "",
  registrationNote: undefined,
};

function lastCreateDoc(): Record<string, unknown> {
  const calls = vi.mocked(addDoc).mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

function lastUpdateDoc(): Record<string, unknown> {
  const calls = vi.mocked(updateDoc).mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.mocked(addDoc).mockClear();
  vi.mocked(updateDoc).mockClear();
});

describe("createEvent — optional empty fields are never written as undefined", () => {
  it("create with End Time empty omits endTime (and other undefined blanks) from the document", async () => {
    const result = await adapter.createEvent(emptyOptionalFields, SUPER_ADMIN);

    expect(result.ok).toBe(true);
    expect(result.id).toBe("ev-generated");

    const doc = lastCreateDoc();
    expect(Object.keys(doc)).not.toContain("endTime");
    expect(Object.keys(doc)).not.toContain("time");
    expect(Object.keys(doc)).not.toContain("registrationNote");
    expect(Object.values(doc)).not.toContain(undefined);

    expect(doc.title).toBe("City Open 2026");
    expect(doc.location).toBe("Mumbai");
    expect(doc.description).toBe("");
    expect(doc.registrationUrl).toBe("");
  });

  it("create with End Time filled writes endTime to the document", async () => {
    const result = await adapter.createEvent(
      { ...emptyOptionalFields, time: "10:00 AM", endTime: "01:00 PM" },
      SUPER_ADMIN,
    );

    expect(result.ok).toBe(true);
    const doc = lastCreateDoc();
    expect(doc.endTime).toBe("01:00 PM");
    expect(doc.time).toBe("10:00 AM");
    expect(Object.values(doc)).not.toContain(undefined);
  });
});

describe("updateEvent — optional empty fields are never written as undefined", () => {
  it("update with End Time empty omits endTime (and other undefined blanks) from the update", async () => {
    const result = await adapter.updateEvent("ev-1", emptyOptionalFields, SUPER_ADMIN);

    expect(result.ok).toBe(true);
    expect(result.id).toBe("ev-1");

    const update = lastUpdateDoc();
    expect(Object.keys(update)).not.toContain("endTime");
    expect(Object.keys(update)).not.toContain("time");
    expect(Object.keys(update)).not.toContain("registrationNote");
    expect(Object.values(update)).not.toContain(undefined);

    expect(update.title).toBe("City Open 2026");
    expect(update.description).toBe("");
  });

  it("update with End Time filled writes endTime to the update", async () => {
    const result = await adapter.updateEvent(
      "ev-1",
      { ...emptyOptionalFields, endTime: "04:00 PM" },
      SUPER_ADMIN,
    );

    expect(result.ok).toBe(true);
    const update = lastUpdateDoc();
    expect(update.endTime).toBe("04:00 PM");
    expect(Object.values(update)).not.toContain(undefined);
  });
});