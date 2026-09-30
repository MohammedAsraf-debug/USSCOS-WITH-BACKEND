import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FirestoreGateway, TxGateway } from "../src/services/firestore.js";
import type { TokenVerifier } from "../src/services/auth.js";
import type { RazorpayGateway } from "../src/services/razorpay.js";
import type { BackendConfig } from "../src/config/env.js";

/** In-memory Firestore stand-in (documents keyed collection/id). */
export class MemoryFirestoreGateway implements FirestoreGateway {
  private readonly db = new Map<string, Map<string, Record<string, unknown>>>();
  private seq = 0;
  /** When true, the next update() throws (fault injection for failure tests). */
  public failNextUpdate = false;

  private col(name: string): Map<string, Record<string, unknown>> {
    let c = this.db.get(name);
    if (!c) {
      c = new Map();
      this.db.set(name, c);
    }
    return c;
  }

  count(collection: string): number {
    return this.col(collection).size;
  }

  async get(collection: string, id: string): Promise<Record<string, unknown> | null> {
    return this.col(collection).get(id) ?? null;
  }

  async set(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
    this.col(collection).set(id, { ...data });
  }

  async update(collection: string, id: string, patch: Record<string, unknown>): Promise<void> {
    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      throw new Error("firestore unavailable");
    }
    const cur = this.col(collection).get(id);
    if (!cur) throw new Error("not-found");
    this.col(collection).set(id, { ...cur, ...patch });
  }

  async create(collection: string, data: Record<string, unknown>): Promise<string> {
    this.seq += 1;
    const id = `test Doc ${this.seq}`.replace(/ /g, "_");
    this.col(collection).set(id, { ...data });
    return id;
  }

  async queryEqual(
    collection: string,
    field: string,
    value: unknown,
    limit: number,
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const out: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const [id, data] of this.col(collection)) {
      if ((data as Record<string, unknown>)[field] === value) {
        out.push({ id, data: { ...data } });
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  async remove(collection: string, id: string): Promise<void> {
    this.col(collection).delete(id);
  }

  /**
   * Atomic single-document create: the existence check and the write happen
   * synchronously with no await between them, so concurrent interleavings in
   * this process cannot both succeed (mirrors the server-side guarantee).
   */
  async createWithId(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
    const c = this.col(collection);
    if (c.has(id)) {
      throw Object.assign(new Error("already exists"), { code: 6 });
    }
    c.set(id, { ...data });
  }

  /**
   * Serialized transactions: each fn runs exclusively, so read-modify-write
   * sequences are atomic within this process (mirrors Firestore semantics
   * closely enough for concurrency regression tests).
   */
  private txTail: Promise<unknown> = Promise.resolve();

  async runTransaction<T>(fn: (tx: TxGateway) => Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.txTail;
    this.txTail = gate;
    await previous;
    try {
      const tx: TxGateway = {
        get: (collection, id) => this.get(collection, id),
        set: (collection, id, data) => this.set(collection, id, data),
        update: (collection, id, patch) => this.update(collection, id, patch),
        remove: (collection, id) => this.remove(collection, id),
        create: (collection, id, data) => this.createWithId(collection, id, data),
      };
      return await fn(tx);
    } finally {
      release();
    }
  }
}

/** Token verifier fake: token string -> uid, anything else throws. */
export class FakeVerifier implements TokenVerifier {
  constructor(private readonly table: Record<string, string> = {}) {}

  async verify(idToken: string): Promise<{ uid: string }> {
    const uid = this.table[idToken];
    if (!uid) throw new Error("invalid token");
    return { uid };
  }
}

/** Scriptable Razorpay fake (no network). */
export class FakeRazorpay implements RazorpayGateway {
  public orders: Array<Record<string, unknown>> = [];
  public paymentEntity: Record<string, unknown> | null = {
    id: "pay_test1",
    order_id: "order_test1",
    amount: 50000,
    currency: "INR",
    status: "captured",
  };
  public refundEntity: Record<string, unknown> = { id: "rfnd_test1", status: "processed", amount: 50000 };
  public failCreateOrder = false;
  public failCreateOrderWith: { status: number; code: string; description: string } | null = null;
  /** When set, order IDs are drawn from this queue (for multi-order tests). */
  public orderIdSequence: string[] = [];

  async createOrder(input: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string }> {
    if (this.failCreateOrderWith) {
      const { RazorpayGatewayError } = await import("../src/services/razorpay.js");
      throw new RazorpayGatewayError(
        this.failCreateOrderWith.status,
        this.failCreateOrderWith.code,
        this.failCreateOrderWith.description,
      );
    }
    if (this.failCreateOrder) throw new Error("gateway down");
    this.orders.push({ ...input });
    return { id: this.orderIdSequence.length > 0 ? (this.orderIdSequence.shift() as string) : "order_test1" };
  }

  async fetchPayment(_paymentId: string): Promise<Record<string, unknown> | null> {
    return this.paymentEntity;
  }

  async createRefund(_paymentId: string, amountPaise: number): Promise<Record<string, unknown>> {
    return { ...this.refundEntity, amount: amountPaise };
  }
}

export function testConfig(overrides: Partial<BackendConfig> = {}): BackendConfig {  return {
    nodeEnv: "test",
    port: 0,
    frontendOrigins: [],
    firebaseProjectId: "test-project",
    firebaseClientEmail: "test@test-project.iam.gserviceaccount.com",
    firebasePrivateKey: "test-key",
    razorpayKeyId: "rzp_test_key",
    razorpayKeySecret: "test_secret",
    razorpayWebhookSecret: "test_webhook_secret",
    privateStoragePath: mkdtempSync(path.join(tmpdir(), "usscos-store-")),
    turnstileSecret: "",
    minAmountInr: 1,
    maxAmountInr: 1000000,
    ...overrides,
  };
}

export function athleteSubmission(nonce: string): Record<string, unknown> {
  return {
    requestFor: "athlete",
    formNonce: nonce,
    consentGiven: true,
    antiSpamToken: nonce,
    application: { fullName: "Arjun R", email: "arjun@example.com", phone: "9876543210" },
    documents: [
      { id: "doc-gov-001", documentCategory: "government-id", documentType: "aadhaar-card", fileName: "aadhaar.pdf", fileSizeBytes: 12345, fileType: "application/pdf" },
      { id: "doc-ach-001", documentCategory: "sports-achievement-proof", fileName: "cert.pdf", fileSizeBytes: 2345, fileType: "application/pdf" },
      { id: "doc-rec-001", documentCategory: "competition-record", fileName: "record.pdf", fileSizeBytes: 3456, fileType: "application/pdf" },
      { id: "doc-med-001", documentCategory: "medical-fitness-certificate", fileName: "medical.pdf", fileSizeBytes: 4567, fileType: "application/pdf" },
    ],
  };
}

export function academySubmission(nonce: string): Record<string, unknown> {
  return {
    requestFor: "group",
    formNonce: nonce,
    consentGiven: true,
    antiSpamToken: nonce,
    application: { fullName: "Rahul M", email: "coach@example.com", organization: "Pune Combat Academy" },
    documents: [
      { id: "doc-reg-001", documentCategory: "academy-registration", documentType: "society-trust-registration", fileName: "reg.pdf", fileSizeBytes: 12345, fileType: "application/pdf" },
      { id: "doc-rep-001", documentCategory: "representative-id", documentType: "aadhaar-card", fileName: "rep.pdf", fileSizeBytes: 2345, fileType: "application/pdf" },
    ],
  };
}

/** Scriptable Firebase Auth fake for admin-user creation (no network). */
export class FakeAdminAuth {
  public created: Array<{ email: string; password: string; displayName: string }> = [];
  public deleted: string[] = [];
  public nextUid = "admin-uid-1";
  /** Throw this error object from createUser (e.g. { code: "auth/email-already-exists" }). */
  public createError: unknown = null;
  public deleteError: unknown = null;
  /** Fail the Nth Firestore-independent step: not used here (see gateway fakes). */
  public failDelete = false;

  async createUser(input: { email: string; password: string; displayName: string }): Promise<{ uid: string }> {
    if (this.createError) throw this.createError;
    this.created.push({ ...input });
    const uid = this.nextUid;
    this.nextUid = `admin-uid-${this.created.length + 1}`;
    return { uid };
  }

  async deleteUser(uid: string): Promise<void> {
    if (this.deleteError) throw this.deleteError;
    if (this.failDelete) throw new Error("delete failed");
    this.deleted.push(uid);
  }
}
