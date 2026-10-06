/**
 * Payment-leak scan (SECURITY regression guard).
 *
 * Spans every browsed source file and asserts that no client code ever writes
 * the server-assigned payment lifecycle fields. The browser may only start a
 * payment at `INITIATED` (firestore-adapter); `PAID` / `REFUNDED` are written
 * exclusively by the server using a service account. Fixtures and the
 * payment-platform client itself are excluded (they legitimately read these
 * fields from the backend API).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "..");
const EXCLUDED_DIRS = new Set(["test", "node_modules", "dist"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDED_PAYMENT_FILES = new Set(["payment-platform.ts", "razorpay-checkout.ts", "payment-flow.ts"]);

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (EXTENSIONS.has(extOf(full))) {
      files.push(full);
    }
  }
  return files;
}

function extOf(file: string): string {
  return extname(file);
}

const files = listSourceFiles(SRC);

const browsersMayWrite: RegExp =
  /paymentStatus\s*[:=]\s*["'](?:PAID|REFUNDED)["']/;

describe("payment lifecycle write-end guard", () => {
  it("scans non-trivial source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no browsed source writes paymentStatus PAID/REFUNDED", () => {
    const offenders = files
      .filter((f) => !EXCLUDED_PAYMENT_FILES.has(f.slice(f.lastIndexOf("/") + 1)))
      .filter((f) => browsersMayWrite.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("firestore-adapter only ever starts a payment at INITIATED", () => {
    const adapter = readFileSync(resolve(SRC, "services/firestore-adapter.ts"), "utf8");
    expect(adapter).toContain('paymentStatus: "INITIATED"');
    expect(adapter).not.toContain('paymentStatus: "PAID"');
    expect(adapter).not.toContain('paymentStatus: "REFUNDED"');
  });

  it("public form components orchestrate via runPaymentFlow (no ad-hoc server calls)", () => {
    const donatePage = readFileSync(resolve(SRC, "pages/public/Donate.jsx"), "utf8");
    const sponsorPage = readFileSync(resolve(SRC, "pages/public/SponsorRequest.jsx"), "utf8");
    expect(donatePage).toContain("runPaymentFlow");
    expect(donatePage).not.toContain("#/api/payments/");
    expect(sponsorPage).toContain("runPaymentFlow");
    expect(sponsorPage).not.toContain("#/api/payments/");
  });
});