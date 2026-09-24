import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FirestoreGateway } from "../src/services/firestore.js";
import type { TokenVerifier } from "../src/services/auth.js";
import type { RazorpayGateway } from "../src/services/razorpay.js";
import type { BackendConfig } from "../src/config/env.js";

/** In-memory Firestore stand-in (documents keyed collection/id). */
export class MemoryFirestoreGateway implements FirestoreGateway {
  private readonly db = new Map<string, Map<string, Record<string, unknown>>>();
  private seq = 0;

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

  async createOrder(input: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string }> {
    if (this.failCreateOrder) throw new Error("gateway down");
    this.orders.push({ ...input });
    return { id: "order_test1" };
  }

  async fetchPayment(_paymentId: string): Promise<Record<string, unknown> | null> {
    return this.paymentEntity;
  }

  async createRefund(_paymentId: string, amountPaise: number): Promise<Record<string, unknown>> {
    return { ...this.refundEntity, amount: amountPaise };
  }
}

export function testConfig(overrides: Partial<BackendConfig> = {}): BackendConfig {
  return {
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
