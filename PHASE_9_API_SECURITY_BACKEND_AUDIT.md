# PHASE 9 — API SECURITY & BACKEND ATTACK-SURFACE AUDIT

> Scope: Node/Express API only. No architecture changes except two
> minimal, proven fixes below. Phases 1–8 guarantees preserved.

## 1. Scope

Every HTTP endpoint in `backend/src/{app,routes/*}` audited live
(requests through supertest against the real Express stack): authN/Z,
validation, IDOR, traversal, methods, CORS, headers, rate limits,
secrets, logging, replay, error envelopes.

## 2. Complete Endpoint Inventory

| Method | Path | Auth | Role | Validation | Rate limit | Data | Side effect | Idempotent | Result |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/health`, `/api/health` | No | — | — | General 600/15m | None | None | Yes | PASS |
| POST | `/api/applications` | No | — | Strict Zod + category gate | 60/15m | Create app + caps | Yes | Atomic (det. ID) | PASS |
| POST | `/api/admin/users` | Bearer | SUPER_ADMIN | Zod allowlist | 30/15m | Auth create + users set + rollback | Yes | N/A (new UID each) | PASS |
| POST | `/api/documents/upload` | Capability | scoped | ext+magic+10 MB | 120/15m | Private file + txn patch | Yes | Single-use cap | PASS |
| GET | `/api/documents/:ref`(+`/download`) | Bearer | SA/ADMIN | strict ref regex | 120/15m | Private bytes | No | Yes | PASS |
| POST | `/api/payments/orders`(+`/order`) | No | — | Full schema | 120/15m | Order + record | Yes | Atomic reservation | PASS |
| POST | `/api/payments/verify` | HMAC proof | — | ids+signature | 120/15m | PAID transition | Idempotent | Yes | PASS |
| POST | `/api/payments/refund` | Bearer | SA/ADMIN | PAID-only | 120/15m | Razorpay refund + REFUNDED | **Guarded (fixed)** | Reservation | PASS |
| POST | `/api/payments/webhook`(+legacy alias) | HMAC raw | — | Event allowlist | 120/15m | Reconcile | Idempotent | Yes | PASS |
| * | unknown | — | — | — | General | None | None | — | 404 PASS |

No static serving, no debug/test routes, no PHP reachability, no dynamic
mounts. Legacy aliases (`/order`, `/api/webhooks/razorpay`) intentional
and tested.

## 3. Route Registration / Legacy Surface

**PASS.** No duplicates, no debug endpoints, no wildcard handlers beyond
the 404 fallback. Multer is scoped to the upload route only.

## 4. Authentication Boundaries

**PASS.** Missing/malformed/invalid/expired tokens rejected on all three
Bearer surfaces (tested: absent, bare `Bearer`, `Basic`, unknown token →
401/403 correctly split). Identity exclusively from verified tokens;
`users/{uid}` re-checked per call. Refund carries its token in-body by
pre-existing contract (still verified server-side, not ambient auth).

## 5. Authorization Matrix

**PASS.** Anonymous only where public by design (health, intake creates
with shape gates, order/verify with cryptographic or schema gates).
CM denied on admin-users/refund/documents (tested). ADMIN denied on
SA-only creation (tested). Webhook needs no browser identity (HMAC is
the credential).

## 6. Input Validation

**PASS** with one hardening fix (below). Zod-strict bodies (applications,
admin-users), field-rebuilt payment/customer/entity objects, strict
capability token shape, strict storage-ref shape, multer caps.
Oversized JSON now 413 (was generic 500 — fixed, behavior-compatible).

## 7. Prototype/Object Injection

**PASS** after fix. Only one verbatim-spread path existed: payment
`payload`. Probes confirmed `__proto__` keys would persist into records.
`sanitizeJson` now deep-strips `__proto__`/`constructor`/`prototype`
(depth-capped) with zero impact on legitimate payloads (tested: accepted
200, clean record, intact prototype). All other paths are zod-strict or
field-rebuilt (verified by negative tests).

## 8. Application API

**PASS.** Strict schema (unknowns rejected), atomic create-only IDs,
server-wins field order, retry convergence, capability scoping — all
covered by Phase 5 suites, re-run green.

## 9. Document API

**PASS.** Auth-before-filesystem, strict refs (traversal/UNC/null-byte/
overlong rejected), magic+ext+size gates, lease lifecycle, wrong-scope
rejection without side effects, orphan cleanup — Phase 4 suites green.

## 10. Payment API

**PASS.** Amount/currency/purpose server-derived and re-checked at verify;
HMAC constant-time for captures and webhooks (raw body preserved);
duplicate webhooks idempotent; refunds use record-owned payment IDs/amounts;
terminal states terminal; reservations atomic.

## 11. Admin User Creation API

**PASS.** SA-only, active-status-checked, role allowlist (SA creation
blocked), email/password/name validated, password never persisted,
Auth+Firestore consistency with rollback, forged uid/role/status ignored
(Phase 7 matrix re-run green).

## 12. Error Handling

**PASS.** Uniform `{code, message}` envelope; no stacks/paths/secrets/
tokens/internals in any response (asserted on 404 + error bodies);
multer limits → 413; bad JSON → 400; oversized JSON → 413 (fixed);
everything else → generic 500. Dev-only gateway detail carries upstream
status/code/description only.

## 13. Rate Limiting / Abuse Controls

Present per surface (60/120/30/600 per 15 min) in front of handlers;
origin rejections precede limiter spend. No brute-forceable login via
backend (Firebase client auth only). Webhook + health share the general
window — adequate, documented.

## 14. Request Size / Resource Exhaustion

1 MB JSON cap, 10 MB multipart cap, 20-doc / bounded-array schemas,
depth-capped sanitizer, bounded polling (8 s) and bounded claim retries.
No request timeout middleware — INFO (platform/reverse-proxy concern).

## 15. CORS

**PASS** (tested live): unknown `Origin` → 403 with no ACAO header;
allowlisted → exact echo + `Allow-Credentials: true` + `Vary: Origin`;
never `*`. Preflight via cors middleware. `Origin: null` and absent
behave safely (deny / no headers respectively).

## 16. HTTP Security

**PASS** (tested live): helmet `nosniff` + `SAMEORIGIN` framing,
`x-powered-by` removed. No CSP (documented choice, matches existing
config — inline-script-heavy Vite bundle).

## 17. Secret Exposure

**PASS.** Greps + response assertions: no Admin/Razorpay/webhook/Turnstile
secrets, tokens, signatures, or paths in any response, log line, or
`VITE_*` variable (frontend secrets scan clean in Phase 2/8).

## 18. Logging Security

**PASS.** Logs carry status codes, masked key prefixes, and safe messages
only. No passwords/tokens/signatures/file bytes/PII logged anywhere in
`backend/src`.

## 19. HTTP Method / Route Confusion

**PASS** (tested): PUT/PATCH/DELETE on POST-only routes → 404.
OPTIONS handled by CORS preflight only. Express non-strict trailing-slash
normalization is benign (same handler).

## 20. Concurrency / Replay

**PASS.** Application nonce, payment key, capability lease, and now
refund slot are all single-winner atomic; losers resolve deterministically
(200-same / 409-in-progress / NOT_PAID). Tested concurrently per surface.

## 21. Security Regression Tests

+11 backend (`payments.test.ts`): concurrent refunds, stale-slot reclaim,
attacker refund fields ignored, oversized JSON, proto-pollution sanitize,
method confusion, unknown endpoint, CORS ×3, helmet. No existing tests
modified.

## 22. Vulnerabilities Found

- **HIGH (fixed): refund double-execution race** — concurrent
  `POST /api/payments/refund` on one PAID order both passed the status
  check and called Razorpay (real double money movement). Root cause:
  read-then-act with no mutual exclusion. Fix: atomic
  `paymentRefundReservations/{orderId}` claim (TTL reclaim, delete on
  gateway failure, kept on success); losers get NOT_PAID (already
  refunded) or 409 in-progress.
- **LOW (fixed): oversized JSON → 500** — `entity.too.large` fell through
  to generic 500. Now 413 `PAYLOAD_TOO_LARGE`.
- **LOW (fixed): `payload.__proto__` persistence** — verbatim passthrough
  stored prototype-pollution keys (contained blast radius, no privilege
  path). Now deep-sanitized; legitimate payloads byte-identical.
- Informational: no request timeouts (platform concern); inline-script
  bundle keeps CSP off by existing choice.

## 23. Fixes Applied

`services/payments.ts` (refund slot + TTL + sanitizer),
`utils/errors.ts` (413 mapping), `tests/payments.test.ts` (+11).
Nothing else touched; all Phase 1–8 invariants preserved.

## 24. Final Verification

- Backend: typecheck PASS · tests **113/113** · build PASS.
- Frontend: typecheck PASS · tests **308/308 (30 files)** · build PASS.
- One full-suite run hit machine resource exhaustion (worker start
  failures, zero assertion failures); clean rerun recorded.

## 25. Remaining Technical Debt

- Refund-slot TTL reclaim window (10 min) for crashed holders (by design).
- `paymentRefundReservations` rows accumulate (audit-useful; add a sweeper
  if volume grows).
- No request timeouts (set at reverse proxy).
- No CSP (matches existing inline-script bundle).
