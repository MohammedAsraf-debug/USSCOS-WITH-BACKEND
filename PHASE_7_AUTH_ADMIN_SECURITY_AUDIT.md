# PHASE 7 — AUTH & ADMIN SECURITY AUDIT

> Scope: authentication + admin authorization only. No rewrites, no UI
> redesign, no Firebase/routing/payment changes. Backend stays authoritative.

## 1. Authentication architecture

Firebase Auth (client SDK) → `watchAuthState`/`syncSession`
(`front-end/src/services/auth.ts`) resolves `users/{uid}` (role + active)
→ `useAuthSession` → `AdminLayout` gate → Bearer ID token per privileged
call → Admin SDK `verifyIdToken` → `users/{uid}` lookup per request.
Password auth uses the client SDK only (never backend/Firestore/logs).

## 2. Login methods

Google popup (`signInWithGoogle`, preserved byte-identical) and
email/password (`signInWithEmail`, Phase 1, for `POST /api/admin/users`
accounts). Both funnel through one session/role resolver. Tested: Google
success/denial, email success/denial/invalid-credential (password cleared,
no credential leak in messages).

## 3. Auth initialization

`useAuthSession` starts `loading` (page-loader, no redirect); resolves on
first callback; listener unsubscribed on unmount; single shared listener
per mount (no duplicates — one `watchAuthState` call per hook instance).
Loading never renders login or dashboard prematurely (tested).

## 4. Frontend route protection

Unauthenticated → `/admin/login`; authorized → shell; logout → login;
direct URLs guarded (layout-level, tested incl. in-app navigation with a
live session). Sidebar shows all sections to all staff (UX only).

## 5. Backend token verification

`AdminTokenVerifier.verifyIdToken` + `bearerToken()` extraction on all
three staff surfaces (`admin-users`, document download, refund).
Invalid/expired/malformed/absent tokens → 401/400 without touching data.
Identity comes only from the verified token. Tested incl. malformed
`Bearer`-only and `Basic` headers.

## 6. Role matrix (actual, from implementation)

- `SUPER_ADMIN`: everything (user creation, refunds, docs, all admin reads).
- `ADMIN`: refunds, document reads, all Firestore-rule staff operations;
  cannot create admins (403).
- `CONTENT_MANAGER`: copy-only catalogue writes via rules; denied on every
  privileged backend endpoint (403).
- Unknown role / inactive status / missing `users/{uid}` doc → fail closed
  (403) on all surfaces. No custom claims anywhere (verified: no
  `setCustomUserClaims` in repo); `users/{uid}` is the sole authority.

## 7. Admin creation security

SA-only gate precedes validation; role allowlist `ADMIN|CONTENT_MANAGER`
(`SUPER_ADMIN` → 400); email/password/name validated; Auth create then
`users/{uid}` write with rollback delete; password never persisted.
Forged `role`/`uid` body fields provably ignored (tested).

## 8. User management security

No server-side user-management endpoints exist beyond creation:
AdminSettings edit/delete and AdminList actions are local-only state
(verified: no `users/` writes outside `auth.ts` DEV bootstrap). Nothing to
escalate through; self-demotion/removal flows do not exist. Documented as
intended, not a gap.

## 9. Status/disabled-user behavior

`users/{uid}.status !== 'active'` denies everywhere (tested: suspended
ADMIN). Residual mismatch: a user disabled in the Firebase console but
still `active` in Firestore keeps access until their ID token expires
(~1h, refresh fails). Deliberately not synchronized (would add a per-call
Admin SDK read + failure mode); mitigation is procedural: set Firestore
status inactive first (immediate). Recorded as accepted residual risk.

## 10. IDOR findings

None. Document/payment/user lookups are scoped by server-held references
and role gates; forged identifiers change nothing (matrix-tested);
unknown IDs return safe 403/404 without oracles.

## 11. Privilege escalation findings

None. CM→SA/ADMIN ops, ADMIN→SA ops, anonymous, inactive, unknown-role,
missing-doc, forged-role, and forged-UID cases all deny (19 matrix tests).
Frontend role displays are never consulted server-side.

## 12. Security tests

New `backend/tests/admin-authz.test.ts` (19: full matrix × 3 surfaces +
forgery cases) and `front-end/src/test/admin-session.test.tsx` (3:
loading, logout, navigation-persistence). No existing tests modified.

## 13. Real Firebase E2E status

NOT RUN (automated). Rationale: no service-account credential may be
minted/stored here and no Auth-emulator wiring exists; matrix fakes cover
every decision branch. Manual verification steps: 1. SA creates ADMIN via
Settings; 2. sign out; 3. sign in with the temp password; 4. dashboard
loads with ADMIN session; 5. refund attempt as CM → 403 toast; 6. disable
via status change → immediate denial.

## 14. Changes made

Tests only, plus one test-stability tweak: `admin-authz.test.ts` (new),
`admin-session.test.tsx` (new), `asyncUtilTimeout 15s` in it and
`routing.test.tsx` (parallel-load flakes, no assertions changed).
Production code: **zero changes** — audit found no vulnerability to fix.

## 15. Files created/modified/deleted

Created: this audit + the two test files above. Modified:
`routing.test.tsx` (timeouts only). Deleted: none.

## 16. Final verification

- Backend: typecheck PASS · tests **102/102** · build PASS.
- Frontend: typecheck PASS · tests **286/286 (30 files)** · build PASS.
- Intermittent harness flakes observed (tinypool worker death backend,
  emulator-init hook timeout frontend) — zero test failures; clean reruns
  recorded for both suites.

## 17. Remaining authentication/admin technical debt

- Email/password login needs the manual E2E above on a real project.
- Console-disabled vs Firestore-active mismatch (see §9).
- No server-side user list/edit/disable endpoints (local-only Settings).
- CM sees SA-only UI affordances (server denies; UX parity).
- Dev-only auto-SA user-doc bootstrap in `auth.ts` (DEV-guarded).
