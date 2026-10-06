/**
 * Gallery event-link write path (M3.3C1 events→gallery integration).
 *
 * Gallery items reuse the existing `galleryImages` collection + adapter; the
 * only new field is `eventId` (optional). Verifies:
 *  - create without event  → `eventId: null` in the Firestore document
 *  - create linked to event → `eventId` stored
 *  - update changes/clears the relationship
 *  - mapper tolerates legacy docs (no `eventId` key) → null
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDoc, updateDoc } from "firebase/firestore";
import { FirestoreDataAdapter, mapGalleryImage } from "@/services/firestore-adapter";
import { CATALOGUE_SCHEMAS } from "@/features/admin/catalogue";
import type { GalleryImageWrite } from "@/features/admin/catalogue";

vi.mock("@/services/firebase", () => ({
  ensureInitialized: () => true,
  firebaseEnabled: true,
  getFirestoreInstance: () => ({ __fake: true }),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(async () => ({ id: "gi-generated" })),
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

const base: GalleryImageWrite = {
  title: "Championship night",
  altText: "Fighters in the ring at the championships",
  category: "Events",
  eventId: null,
  publicUrl: "https://cdn.example.com/night.jpg",
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

describe("gallery schema — eventId optional field", () => {
  it("accepts a payload without an event relationship", () => {
    expect(CATALOGUE_SCHEMAS.galleryImages.safeParse(base).success).toBe(true);
  });

  it("accepts a payload linked to an event", () => {
    expect(
      CATALOGUE_SCHEMAS.galleryImages.safeParse({ ...base, eventId: "ev-1" }).success,
    ).toBe(true);
  });

  it("accepts a payload clearing the event relationship back to null", () => {
    expect(
      CATALOGUE_SCHEMAS.galleryImages.safeParse({ ...base, eventId: null }).success,
    ).toBe(true);
  });
});

describe("createGalleryImage — event link is written", () => {
  it("create without an event stores eventId null", async () => {
    const result = await adapter.createGalleryImage(base, SUPER_ADMIN);

    expect(result.ok).toBe(true);
    const doc = lastCreateDoc();
    expect(doc.eventId).toBeNull();
    expect(Object.values(doc)).not.toContain(undefined);
  });

  it("create linked to an event stores the eventId", async () => {
    const result = await adapter.createGalleryImage({ ...base, eventId: "ev-1" }, SUPER_ADMIN);

    expect(result.ok).toBe(true);
    const doc = lastCreateDoc();
    expect(doc.eventId).toBe("ev-1");
  });
});

describe("updateGalleryImage — event relationship can be edited", () => {
  it("update changes the event relationship", async () => {
    const result = await adapter.updateGalleryImage(
      "gi-1",
      { ...base, eventId: "ev-2" },
      SUPER_ADMIN,
    );

    expect(result.ok).toBe(true);
    const update = lastUpdateDoc();
    expect(update.eventId).toBe("ev-2");
  });

  it("update clears the event relationship to null (general content)", async () => {
    const result = await adapter.updateGalleryImage("gi-1", base, SUPER_ADMIN);

    expect(result.ok).toBe(true);
    const update = lastUpdateDoc();
    expect(update.eventId).toBeNull();
  });
});

describe("mapGalleryImage — legacy documents without eventId", () => {
  it("defaults a legacy doc (no eventId key) to null", () => {
    const mapped = mapGalleryImage("gi-legacy", {
      title: "Old photo",
      altText: "Old photo",
      category: "Photos",
      publicUrl: "https://cdn.example.com/old.jpg",
    });
    expect(mapped.eventId).toBeNull();
  });

  it("reads eventId from a linked document", () => {
    const mapped = mapGalleryImage("gi-linked", {
      altText: "Linked media",
      category: "Events",
      eventId: "ev-9",
      publicUrl: "https://cdn.example.com/link.jpg",
    });
    expect(mapped.eventId).toBe("ev-9");
  });
});