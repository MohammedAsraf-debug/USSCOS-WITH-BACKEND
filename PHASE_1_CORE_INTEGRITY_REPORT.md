# PHASE 1 — CORE INTEGRITY & SECURITY REPORT

> Root: `D:\Client-Website`. Baseline: Phase 0 (`PHASE_0_BASELINE_AUDIT.md`).
> Scope: critical/high integrity + security fixes only. No Phase 2 cleanup
> (legacy trees untouched), no UI redesign, no unrelated functionality.

## 1. Changes Made

1. **Admin login flow** — email/password sign-in added alongside Google.
2. **Application idempotency** — atomic via deterministic IDs + create-only writes.
3. **Payment idempotency** — atomic via deterministic reservation documents.
4. **Capability double-spend** — transactional lease claim/release/consume.
5. **Metadata lost-update** — transactional PATCH inside uploads.
6. **Anonymous capability recovery removed** (`POST /api/documents/upload-token`
   deleted + frontend fallback deleted).
7. **Storage rules** tightened to explicit deny-all (verified dormant/unused).

## 2. Admin Authentication Flow

Verified first: `AdminLogin.jsx` was Google-only (`signInWithGoogle` popup);
`POST /api/admin/users` provisions email/password users; role resolution is
`users/{uid}` (role + active) via `syncSession`; backend verifies ID tokens
with the Admin SDK (`AdminTokenVerifier`) and gates per endpoint.

Change (`front-end/src/services/auth.ts`, `pages/admin/AdminLogin.jsx`):
new `signInWithEmail(email, password)` using Firebase **client**
`signInWithEmailAndPassword` only — passwords never touch our backend, never
stored, never logged (cleared from state after every attempt); identical
`syncSession` role resolution, so Google and email flows share one session,
one guard (`AdminLayout` + `useAuthSession`), one backend boundary.
Login UI adds an email form (safe per-code error mapping, no credential
leak in messages). Google flow byte-identical.

Resulting flow: Admin Login (Google or email) → Firebase Auth → ID token →
`users/{uid}` role resolution → dashboard; backend remains final authority
(401 invalid, 403 non-SUPER_ADMIN on privileged endpoints).

## 3. Application Idempotency

Was: query-`formNonce` then create (race → duplicates).
Now (`backend/src/services/applications.ts`): application ID is deterministic
(`app_` + sha256(`formNonce`), always ID-safe) and creation is a single
atomic `createWithId` (`Firestore.create()` semantics — fails if the path
exists). N concurrent same-nonce requests → exactly one record; losers read
the winner and return the same ID with fresh per-caller capabilities.
Retries merge newly submitted metadata rows **transactionally** and re-offer
capabilities for non-ready documents. Response format unchanged
(`{applicationId, uploads[]}`); old capabilities stay valid (nothing revoked).

## 4. Payment Idempotency

Was: query-`idempotencyKey` then Razorpay-create then record (race → duplicate
gateway orders). Now (`backend/src/services/payments.ts`): deterministic
reservation docs `paymentIdempotency/idem_<sha256(key)>` claimed by one
atomic `createWithId`. Winner creates the Razorpay order + record, then
publishes `orderId`; concurrent losers poll briefly (bounded 8 s) and resolve
to the same order/record; completed keys stay terminal (409), INITIATED keys
reuse with the amount-mismatch flag, FAILED keys roll forward (history kept
in `previousOrderIds`); crashed creators leave ownerless reservations that
are reclaimed past a 5-min TTL (in-progress callers get an honest 409, never
a duplicate order). Razorpay semantics, amounts, receipt shape, response
format, webhook/verify/refund paths untouched.

## 5. Document Capability Security

`backend/src/services/capabilities.ts` now implements a lease lifecycle
(`claimedAt`/`claimOwner` on the record): `claimCapability` validates +
claims **inside one transaction** (scope, TTL, constant-time hash; fresh
foreign lease rejected; stale lease take-over allowed); `releaseCapability`
(same-owner, best-effort) runs on any failed attempt so the same token stays
retryable; `consumeCapability` (delete) runs only on success. `peek`
(validate-without-claim) is deleted. No secret is ever logged; only hashes
are stored.

## 6. Document Metadata Concurrency

`uploadDocument` (`backend/src/services/documents.ts`) PATCHes the
`documents` array **inside a Firestore transaction** (re-read, map one
entry to `ready`, write back). Concurrent uploads of different documents
both land; the loser of a same-capability race never reaches the filesystem
(no orphan files); failed PATCHes unlink the partial file and release the
lease. Data model unchanged (no subcollection migration).

## 7. Capability Issuance

`POST /api/documents/upload-token` is deleted (`backend/src/routes/documents.ts`;
unknown paths already 404 via the app fallback). Frontend
`issueApplicationUploadToken` + its fallback call are deleted
(`front-end/src/services/private-documents.ts`); `uploadPrivateDocument`
requires the capability issued with the application (retry = idempotent
re-POST → fresh capabilities). Full-project search confirmed zero remaining
callers/references on either side.

## 8. Firebase Storage Rules

Verified genuinely unused: no `firebase/storage` import in `front-end/src`,
no `storage` key in `firebase.json`, `@firebase/storage` installed but never
imported (flagged for Phase 2 pruning). `front-end/storage.rules` rewritten
to explicit deny-all with a dormancy header (file kept because tooling may
reference it; nothing deployed reads it).

## 9. Tests Added

- Backend `tests/admin-users.test.ts` — pre-existing (12 cases, re-verified).
- `front-end/src/test/admin-login.test.tsx` (6): Google success/denial,
  email success with credential args + navigation, invalid-credential error +
  password cleared + no credential leak, null-session denial, signed-out stays.
- Backend `tests/applications.test.ts` (+2): 10× same-nonce → 1 app/1 ID
  (+usable caps each); different nonces → 2 apps.
- Backend `tests/payments.test.ts` (+3): sequential retry → same order/1
  Razorpay call; 10× same-key → 1 order/1 record/same ID; different keys →
  different orders.
- Backend `tests/documents.test.ts` (+3): same-cap concurrency → [201,403]
  with intact winner metadata; different-doc concurrency → both ready with
  distinct refs; `upload-token` → 404.

## 10. Existing Tests

All preserved and passing — no test modified, weakened, or deleted
(except pure additions). Notable: wizard suites pin the backend transport
(unaffected — response shapes preserved); `private-docs-access` pins the
missing-capability contract (unchanged); rules suites untouched (no rules
changes).

## 11. Typecheck

- Backend `npm run typecheck` (`tsc --noEmit`): **PASS**, 0 errors.
- Frontend `npm run typecheck` (`tsc -b`): **PASS**, 0 errors.

## 12. Production Build

- Backend `npm run build` (`tsc -p tsconfig.build.json`): **PASS**
  (`dist/server.js` emitted).
- Frontend `npm run build` (`tsc -b && vite build`): **PASS**
  (only the pre-existing chunk-size advisory).

## 13. Remaining Issues

- The atomicity guarantees hold at the Firestore/lease layer; end-to-end
  load testing against a real project (not just hermetic fakes) is still
  advisable before launch traffic.
- `previousOrderIds` history has no reader UI yet (data preserved, unused).
- Stuck in-progress payments surface 409 until TTL reclaim (by design;
  consider admin visibility in Phase 2).
- The `Add Admin` → email-login loop still needs a live end-to-end pass
  with real Firebase (Google session + created ADMIN sign-in).

## 14. Files Changed

Backend: `src/services/firestore.ts` (txn + createWithId + already-exists),
`src/services/capabilities.ts` (lease), `src/services/documents.ts`
(claim/txn upload), `src/services/applications.ts` (deterministic IDs),
`src/services/payments.ts` (reservations), `src/routes/documents.ts`
(route removed), `src/routes/payments.ts` (debug plumbing),
`src/middleware/security.ts` (adminLimiter), `src/app.ts`, `src/server.ts`
(users gateway), `tests/fakes.ts` (+FakeAdminAuth already present; txn
support, order-ID sequencing).
Frontend: `src/services/auth.ts` (`signInWithEmail`),
`src/pages/admin/AdminLogin.jsx` (email form), `src/styles/admin.css`
(login label contrast), `src/services/private-documents.ts` (fallback
removed), `front-end/storage.rules` (deny-all).
Tests: `tests/{applications,payments,documents}.test.ts` (backend, +8),
`src/test/admin-login.test.tsx` (new, 6).

## 15. Files Deleted

None (per Phase 1 rules — dead UI/PHP/legacy removal is Phase 2).

## 16. Security Considerations

- Passwords: client→Firebase only; never backend, Firestore, logs, or state.
- Capabilities: hash-only storage, constant-time compare, scoped, TTL +
  lease, single-use, no secret logging; recovery endpoint eliminated.
- Authorization unchanged and server-side (SA-only creation/refund/docs;
  CM denied); Firestore rules untouched.
- Dev-only gateway detail carries upstream status/code/description (no
  secrets); production stays generic.
- Storage rules deny-all; Storage product unused.

## 17. Phase 2 Recommendations

1. Live end-to-end passes (Add-Admin→email-login; concurrent-submission
   soak; Razorpay test-mode payment incl. webhook + refund).
2. Repository cleanup (legacy trees, dead UI kit/forms/registry, temp files,
   unused deps, Zod alignment) — explicitly deferred.
3. Admin UI role parity (hide SA-only actions from CM/ADMIN where the server
   already denies).
4. Reader UI for `previousOrderIds` + stuck-payment visibility.
5. Capability sweeper for orphaned (never-consumed) rows.
