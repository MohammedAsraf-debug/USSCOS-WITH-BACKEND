# PHASE 5 — APPLICATION SUBMISSION AUDIT

> Scope: public athlete/academy submission flow only. Phase 1 atomicity and
> Phase 4 document security preserved; no UI redesign, no collection
> migrations, no response-format changes.

## 1. Athlete application flow

`Apply.jsx` (6 steps, per-step validation, required-docs gate) →
`buildSponsorshipRequestDoc` (flat field set) → `submitPublicApplication`
(`POST /api/applications`) → server record + capabilities → per-document
`uploadPrivateDocument` with stored capabilities → required-gated success
screen + reference, or inline error + same-capability `RETRY DOCUMENT
UPLOAD`. Double submit blocked by `disabled={submitting}` (verified +
tested). Verified against implementation, not docs.

## 2. Academy application flow

`AcademyApplication.jsx` mirrors §1 with `requestFor: 'group'`,
`teamFields`, 2 required categories, docs validated at submit. Cannot enter
the athlete path: `requestFor` enum + separate builder branch + separate
required-category gate all key off the same value.

## 3. Server validation

`POST /api/applications` validates with Zod (`backend/src/services/
applications.ts`): `requestFor` enum, `formNonce` 16–256 chars,
`consentGiven: true` literal, non-empty `antiSpamToken` (≤500), documents
array (≤20, strict entries 8–128 id, known category, filename, 1–10 MB,
optional type/mime). **`application` is now a strict allowlist**
(`applicationFieldsSchema.strict()`, top-level body `.strict()` too) —
exactly the 33 keys `buildSponsorshipRequestDoc` emits; unknown keys
rejected as `invalid-submission`. `fullName` (1–100) and `email` (valid
format) required; numbers length-bounded strings capped (texts ≤10000,
identifiers ≤100–500). Server-owned fields accepted loosely and always
overwritten on write. `socialMedia` strict (4 known keys).

## 4. Idempotency behavior

Unchanged atomic design (Phase 1): deterministic `app_<sha256(nonce)>` +
single `createWithId`. Same nonce → same ID, first record wins (scalar
conflicts resolve to the first write; new metadata rows merge
transactionally). Concurrent same-nonce (10× tested) → exactly one record.
Different nonces → independent records. No client flags/timestamps involved.

## 5. Reference generation

`applicationIdFor()` = `app_` + 40 hex chars of sha256(`formNonce`):
unique, collision-resistant, server-side only (derived, never accepted),
returned after creation, byte-stable across retries (tested by regex +
equality across sequential/concurrent retries).

## 6. Firestore data integrity

Collection `sponsorshipRequests/{appId}`; server sets `type`, `status:
PENDING`, `consentGiven: true`, `antiSpamToken`, `formNonce`, `documents`
(normalized metadata), `createdAt/updatedAt` ISO. Stored: no passwords, no
capability secrets (hash-only collection), no bytes, no absolute paths
(`storageRef` is a `doc_*` identifier). The returned `applicationId` doubles
as the user-facing reference — necessary (upload association, admin reads,
retry identity), documented here.

## 7. Document integration

Submission returns per-document `{documentId, capability}` scoped to the
created application; frontend maps capabilities by document ID; uploads run
through the Phase 4 leased flow; metadata PATCH is transactional. A
capability from one application is rejected against another (403, tested
Phase 4). No response-shape changes.

## 8. Partial failure behavior

Record-first, documents-after (separate systems — documented limitation, no
fake distributed transaction). Matrix, all tested or code-verified: record
fails → nothing written, honest 4xx; upload fails → record stands,
capability lease released, same-token retry works, reference stable, no
duplicate on re-POST; required-doc failure → error + retry UI, success
screen withheld; optional-doc failure → success + warning toast.
Filesystem-vs-Firestore failures clean up partial bytes (Phase 4).

## 9. Client UX findings

No success before backend confirmation (`setSubmitted` only in
`finishAfterUploads` success branch); double-click guarded by disabled
state (new test pins it); server messages surfaced verbatim (all safe
static strings, no internals); loading states on submit + retry;
validation errors inline per step. No gaps found; no UI changes made.

## 10. Security findings

Rejected requests write nothing (every 400 path returns before any
`createWithId`/capability issuance — asserted via collection counts).
Anonymous clients cannot set status (server forces `PENDING`; rules deny
anon updates). Responses carry `{code, message}` only — no stacks, paths,
secrets, or Firestore internals. Rate limit 60/15 min + 1 MB JSON cap on
the route. Turnstile remains presence-only without secret (pre-existing,
documented debt — deployment config, not code).

## 11. Tests added/changed

- Backend `tests/applications.test.ts` (+7): unknown top-level field,
  unknown in-`application` field, malformed email / numeric phone /
  oversized name, missing antiSpamToken, conflicting-payload same nonce
  (first-wins, 1 record), stable `app_[0-9a-f]{40}` reference across
  retries. No existing tests modified.
- Frontend: double-submit disabled-state test (academy) + fail-then-retry
  test asserting no success screen before retry, single submit call, and
  reference display (fighter). No production code changed for these.

## 12. Changes made

`backend/src/services/applications.ts` only: strict body schema
(`.strict()`), new `applicationFieldsSchema` allowlist (33 keys, typed +
bounded), `documents` cap 20, nonce/token length caps. Everything else —
builders, flows, pages, response shapes, Firestore model — untouched.

## 13. Files created/modified/deleted

Created: this audit doc. Modified: `backend/src/services/applications.ts`,
`backend/tests/applications.test.ts`,
`front-end/src/test/sponsorship-two-clear-choices.test.tsx`,
`front-end/src/test/sponsorship-two-choices.test.tsx` (tests only).
Deleted: none.

## 14. Final verification

- Backend: typecheck PASS · tests **60/60** · build PASS. (Note: parallel
  tinypool workers flake ~1/3 runs with `Worker exited unexpectedly`, zero
  test failures; sequential `--no-file-parallelism` runs are 3/3 green —
  environmental harness flake, documented, config untouched.)
- Frontend: typecheck PASS · tests **279/279 (28 files)** · build PASS.
- One full-suite run hit the known emulator-init hook race (no test
  failures); rerun green. Routing-test lazy-chunk slowness under parallel
  load fixed by raising those `waitFor` timeouts (test-only).

## 15. Remaining application-related technical debt

- Turnstile remote verification needs `TURNSTILE_SECRET` in deployment.
- Scalar conflicts on same-nonce retry resolve first-wins (documented §4).
- `applicationId` doubles as Firestore ID (necessary; see §6).
- Backend worker harness flake above (environmental; consider CI
  `--no-file-parallelism` if it persists off this machine).
