import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasFirebaseCredentials,
  hasRazorpayCredentials,
  loadConfig,
} from "../src/config/env.js";

describe("backend environment configuration", () => {
  it("parses origins CSV and numeric bounds with safe fallbacks", () => {
    const cfg = loadConfig({
      FRONTEND_ORIGIN: "https://usscos.org, https://www.usscos.org,,",
      PORT: "not-a-port",
      MIN_AMOUNT_INR: "0",
      MAX_AMOUNT_INR: "-5",
    } as NodeJS.ProcessEnv);
    expect(cfg.frontendOrigins).toEqual(["https://usscos.org", "https://www.usscos.org"]);
    expect(cfg.port).toBe(3000);
    expect(cfg.minAmountInr).toBe(1);
    expect(cfg.maxAmountInr).toBe(1000000);
  });

  it("webhook secret falls back to the key secret (legacy PHP parity)", () => {
    const cfg = loadConfig({ RAZORPAY_KEY_SECRET: "shh" } as NodeJS.ProcessEnv);
    expect(cfg.razorpayWebhookSecret).toBe("shh");
    const explicit = loadConfig({
      RAZORPAY_KEY_SECRET: "shh",
      RAZORPAY_WEBHOOK_SECRET: "hook",
    } as NodeJS.ProcessEnv);
    expect(explicit.razorpayWebhookSecret).toBe("hook");
  });

  it("expands escaped newlines in the private key", () => {
    const cfg = loadConfig({ FIREBASE_PRIVATE_KEY: "line1\\nline2" } as NodeJS.ProcessEnv);
    expect(cfg.firebasePrivateKey).toBe("line1\nline2");
  });

  it("resolves the private storage path to an absolute path", () => {
    const relative = loadConfig({ PRIVATE_STORAGE_PATH: "./storage/private" } as NodeJS.ProcessEnv);
    expect(path.isAbsolute(relative.privateStoragePath)).toBe(true);
    expect(relative.privateStoragePath.endsWith(path.join("storage", "private"))).toBe(true);
    const absolute = loadConfig({ PRIVATE_STORAGE_PATH: "/data/private-docs" } as NodeJS.ProcessEnv);
    expect(path.isAbsolute(absolute.privateStoragePath)).toBe(true);
    expect(absolute.privateStoragePath.endsWith("private-docs")).toBe(true);
  });

  it("fails closed when credentials are missing", () => {
    const empty = loadConfig({} as NodeJS.ProcessEnv);
    expect(hasFirebaseCredentials(empty)).toBe(false);
    expect(hasRazorpayCredentials(empty)).toBe(false);
    const partial = loadConfig({ FIREBASE_PROJECT_ID: "x" } as NodeJS.ProcessEnv);
    expect(hasFirebaseCredentials(partial)).toBe(false);
    const full = loadConfig({
      FIREBASE_PROJECT_ID: "x",
      FIREBASE_CLIENT_EMAIL: "y",
      FIREBASE_PRIVATE_KEY: "z",
      RAZORPAY_KEY_ID: "a",
      RAZORPAY_KEY_SECRET: "b",
    } as NodeJS.ProcessEnv);
    expect(hasFirebaseCredentials(full)).toBe(true);
    expect(hasRazorpayCredentials(full)).toBe(true);
  });
});
