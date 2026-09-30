# PHASE 6 — PAYMENT HARDENING AUDIT

> Scope: payment system only. No architecture changes, no UI redesign, no
> Razorpay/auth/routing/SEO work. All findings below were verified against
> the implementation, then covered by tests.

## 1. Payment architecture

Donate/SponsorRequest → `runPaymentFlow` (order → checkout popup →
server verify) → `paymentRecords/{orderId}` ledger → HMAC webhooks →
receipt-gated `/payment/success`. Razorpay via direct REST (Basic auth);
checkout.js popup only. No PHP, no client writes, no Storage.

## 2. State machine

`INITIATED → PAID | FAILED | REFUNDED`, `PAID → REFUNDED`, `FAILED → PAID`
(`services/payments.ts::TRANSITIONS`, unit-tested incl. invalid
`REFUNDED→PAID`, `PAID→INITIATED`, unknown states). Enforced at every
writer (verify, webhook ×3, refund); webhooks no-op on illegal transitions
instead of erroring (Razorpay-safe).

## 3. Order creation

`POST /api/payments/orders` (+ `/order` alias): purpose enum, INR-only,
`toPaise` (positive, finite, ≤2dp; unit-tested incl. `₹100.00→10000`),
1–10,00,000 bounds, antiSpamToken presence (Turnstile iff secret set),
server-derived paise/receipt/notes, Razorpay-issued order IDs. Browser
fields (`paymentStatus`, `paymentId`, …) ignored (tested). Unconfigured
Razorpay → 503, never fake success.

## 4. Payment idempotency

Unchanged atomic design (Phase 1): deterministic reservation docs, one
winner, losers poll briefly then resolve to the same order; terminal keys
409; FAILED rolls forward with `previousOrderIds` history. Sequential,
concurrent (10×), and cross-key cases tested.

## 5. Signature verification

`POST /api/payments/verify`: HMAC-SHA256(`order|payment`, secret),
constant-time compare; then existence → idempotent same-capture fast path
→ terminal guard → transition guard → signature → live fetch → order /
amount / currency / captured checks, all against the server record. A
signature for another order fails (HMAC binds the order ID); nothing
client-supplied influences the outcome. Tested for every combination.

## 6. Amount/currency/purpose integrity

Amounts/currency come from the stored record vs the live Razorpay fetch;
mismatches reject without state change (tested each). Purpose is
write-once at order creation and never read from verify input (tested
unchanged post-verify).

## 7. Webhook handling

`POST /api/payments/webhook` (+ legacy `/api/webhooks/razorpay` alias):
raw-body HMAC (secret never logged), JSON + event allowlist
(`payment.captured|failed`, `order.paid`, `refund.processed|paid|failed`),
unknown events acked without side effects, duplicate deliveries deduped
via attempt history, amount/currency guards before marking PAID, refund
lookup by `payment_id`. No browser auth involved (HMAC only).

## 8. Verify/webhook race handling

Both orders converge on stable PAID: webhook-first → verify returns the
stored completion idempotently; verify-first → stale `payment.failed`
no-ops (FAILED transition only from INITIATED). Tested both directions;
no downgrade possible.

## 9. Refund handling

`POST /api/payments/refund`: SA/ADMIN ID-token + active-role check (CM and
anonymous denied, tested); PAID-only eligibility; uses the record's own
Razorpay payment ID (a caller cannot name another payment); full-amount
server-side; `processed|paid` → REFUNDED else PENDING with metadata;
duplicate refund rejected without a second gateway call (tested via call
counter); re-verify after refund stays terminal.

## 10. Success/failure UX

Success page renders only a shape-validated verified receipt (direct visit
→ fallback; tampered → fallback; refresh → stable, never re-pays).
Checkout open failure / popup payment errors → error stage, verify never
called (tested). Donate/SponsorRequest failure panels retry with the same
idempotency key (tested at page level: same key twice, pledge created
once, success navigates).

## 11. Security tests

Backend `payments.test.ts` +23: unknown order, cross-order signature,
order/amount/currency/capture mismatches, missing payment, purpose +
customer immutability, concurrent verify, failed/order.paid/refund
webhooks, both race orders, duplicate/mis-targeted refunds, post-refund
re-verify, client-declared state ignored, unknown webhook event, amount
bounds + precision + types, missing key/token/currency, `toPaise` +
state-machine units. Frontend: checkout-open failure, popup payment
error, Donate retry page test (2). No existing tests modified.

## 12. Changes made

- `backend/tests/fakes.ts`: refund call log (duplicate-refund proof).
- `backend/tests/payments.test.ts`: +23 tests above.
- `front-end/src/test/payment-flow.test.ts`: +2 (checkout-open failure,
  popup payment error).
- `front-end/src/test/donate-payment-retry.test.tsx`: new (retry key
  stability, dismiss behavior, success navigation).
- Production code: **zero changes** — audit found no defect to fix.

## 13. Files created/modified/deleted

Created: this audit + `donate-payment-retry.test.tsx`. Modified: backend
`fakes.ts`, `payments.test.ts`; frontend `payment-flow.test.ts`. Deleted:
none.

## 14. Final verification

- Backend: typecheck PASS · tests **83/83** · build PASS.
- Frontend: typecheck PASS · tests **283/283 (29 files)** · build PASS.
- One full-suite run hit the known emulator-init hook race (zero test
  failures); rerun fully green.

## 15. Remaining payment technical debt

- `previousOrderIds` is write-only audit history (verified harmless —
  never read by authorization, amounts, or transitions); no reader UI.
- Live Razorpay Test-Mode pass (real checkout + webhook delivery) still
  advisable; automated coverage is fake-gateway-based by design.
- Turnstile remote verification needs its secret in deployment.

## 16. Production Razorpay configuration requirements

- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`: live/test pair from one
  account + mode; `VITE_RAZORPAY_KEY_ID` must equal the backend key ID
  (mismatch fails closed). Secrets in `backend/.env` only (gitignored).
- `RAZORPAY_WEBHOOK_SECRET`: dashboard webhook secret; Razorpay dashboard
  must point the webhook at `POST {backend}/api/payments/webhook`
  (legacy `/api/webhooks/razorpay` also served).
- `MIN/MAX_AMOUNT_INR`, `FRONTEND_ORIGIN` (CORS), optional
  `TURNSTILE_SECRET`. No Blaze/storage/service-account extras needed
  beyond the existing Firebase Admin credential.
