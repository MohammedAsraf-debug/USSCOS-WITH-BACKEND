import type { Firestore } from "firebase-admin/firestore";

/** Plain-JSON Firestore seam. Swappable for hermetic unit tests. */
export interface FirestoreGateway {
  get(collection: string, id: string): Promise<Record<string, unknown> | null>;
  set(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  create(collection: string, data: Record<string, unknown>): Promise<string>;
  queryEqual(
    collection: string,
    field: string,
    value: unknown,
    limit: number,
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  remove(collection: string, id: string): Promise<void>;
}

function plain(value: unknown): unknown {
  if (value !== null && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    try {
      return ((value as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = plain(v);
    return out;
  }
  return value;
}

/** Production gateway over the Firebase Admin SDK (bypasses security rules). */
export class AdminFirestoreGateway implements FirestoreGateway {
  constructor(private readonly db: Firestore) {}

  async get(collection: string, id: string): Promise<Record<string, unknown> | null> {
    const snap = await this.db.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return plain(snap.data()) as Record<string, unknown>;
  }

  async set(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(collection).doc(id).set(data);
  }

  async update(collection: string, id: string, patch: Record<string, unknown>): Promise<void> {
    await this.db.collection(collection).doc(id).update(patch);
  }

  async create(collection: string, data: Record<string, unknown>): Promise<string> {
    const ref = await this.db.collection(collection).add(data);
    return ref.id;
  }

  async queryEqual(
    collection: string,
    field: string,
    value: unknown,
    limit: number,
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const snap = await this.db.collection(collection).where(field, "==", value).limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, data: plain(d.data()) as Record<string, unknown> }));
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.db.collection(collection).doc(id).delete();
  }
}
