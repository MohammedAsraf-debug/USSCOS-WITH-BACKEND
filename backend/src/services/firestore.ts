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
  /**
   * Atomic single-document create. Resolves when the document did not exist
   * and was created; rejects with an already-exists error otherwise. This is
   * the primitive behind deterministic idempotency (no check-then-write).
   */
  createWithId(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  /** Run fn atomically (serializable reads + writes). Retried by Firestore on contention. */
  runTransaction<T>(fn: (tx: TxGateway) => Promise<T>): Promise<T>;
}

/** Transactional document access. All reads must precede writes. */
export interface TxGateway {
  get(collection: string, id: string): Promise<Record<string, unknown> | null>;
  set(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  create(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
}

/** True when err signals "document already exists" (Admin SDK code 6). */
export function isAlreadyExists(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") return true;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("already exists");
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

  async createWithId(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(collection).doc(id).create(data);
  }

  async runTransaction<T>(fn: (tx: TxGateway) => Promise<T>): Promise<T> {
    const db = this.db;
    return db.runTransaction(async (t) => {
      const tx: TxGateway = {
        get: async (collection, id) => {
          const snap = await t.get(db.collection(collection).doc(id));
          if (!snap.exists) return null;
          return plain(snap.data()) as Record<string, unknown>;
        },
        set: (collection, id, data) => {
          t.set(db.collection(collection).doc(id), data);
          return Promise.resolve();
        },
        update: (collection, id, patch) => {
          t.update(db.collection(collection).doc(id), patch);
          return Promise.resolve();
        },
        remove: (collection, id) => {
          t.delete(db.collection(collection).doc(id));
          return Promise.resolve();
        },
        create: (collection, id, data) => {
          t.create(db.collection(collection).doc(id), data);
          return Promise.resolve();
        },
      };
      return fn(tx);
    });
  }
}
