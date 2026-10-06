# PHASE 8 — DATA INTEGRITY & FIRESTORE SECURITY AUDIT

> Scope: Firestore data integrity + rules security only. No architecture,
> collection, UI, or flow changes. One test-expectation fix (mine, wrong
> about staff reads) and 22 new rule tests; zero production-code changes.

## 1. Scope

Proved from source: rules correctness per collection, default-deny,
users/CM/intake/payment/document integrity, IDOR matrix, client-vs-server
authority, races, field integrity, deletes, dormant collections, rule-test
coverage, Admin SDK authority, security matrix. No fixes required beyond
tests — no production vulnerability found.

## 2. Firestore Data Model Inventory

16 matched collections; app-touched: `users` (auth/session, backend gates),
`sponsorshipRequests` (backend intake + staff admin), `sponsorApplications`
+ `contactMessages` + `donationPledges` (anon-create intake + staff admin),
`paymentRecords` (backend ledger only), `privateUploadCapabilities`
(backend only, no rules entry → default-deny clients), `athletes`,
`groups`, `events`, `stories`, `galleryImages`, `partners`,
`opportunities`, `sportDisciplines`, `contentBlocks`, `siteSettings`,
`auditLogs` (client catalogue/CMS/workflow per role gates),
`contactMessages`. Dormant in app code: `sponsorships`, `needsList`
(rules-guarded, no readers/writers — LOW).

## 3. Security Rules Architecture

Single `firestore.rules` (420 lines, repo = deployed, verified
byte-identical): role helpers via `get(users/{uid})` (role + active);
per-collection match blocks; no recursive/broad wildcards; three dead
helpers (`isPublicFormCreate`, `noAdminFieldsBlocked`, `noStatusOpen` —
unused, harmless, LOW cleanup note). Intake creates are anonymous-only
with shape gates; catalogue writes are staff-gated with CM field
allowlists; ledger is explicit deny-all clients.

## 4. Default-Deny Analysis

**PASS.** No catch-all rule exists, so unknown collections/paths deny by
default (Firestore semantics). Verified by review; unknown-path probes are
not writable/readable under any role.

## 5. Users Security

**PASS.** Self-read allowed (bootstrap necessity); staff-reads-any is
intentional (pinned by test). Create/update SA-only (self-promotion,
ADMIN/CM plants, cross-user edits all denied — tested). Delete always
denied. Dev-only client SA bootstrap in `auth.ts` fails closed against
these rules (deny, console error) — INFORMATIONAL dead path, not a hole.

## 6. CMS / Content Manager Security

**PASS** with documented breadth. CM catalogue updates are allowlist +
blocklist enforced (`approvalStatus`, `featured`, `order`, `contactInfo`
unwritable — injection-tested incl. mixed payloads). Known broad-but-
consistent grants (documented, unchanged): stories CM full-update
(incl. `published`), `sponsorships` CM update except 3 fields,
`contentBlocks` any-staff full write, gallery `order`-only block.
Malicious `{role, status, ownerId, amount}` payloads against catalogue
paths are rejected by allowlist mismatch (tested).

## 7. Sponsorship Application Integrity

**PASS.** Anonymous creates shape-gated (status/consent/token/blocked
keys); server spread order guarantees server-owned fields win over any
client-supplied `type/status/consentGiven` (verified in
`services/applications.ts`); IDs are server-derived hashes, never
client paths; reads staff-only; updates/deletes SA/ADMIN-only. Phase 5
Zod validation is additive on top, never bypassable via direct writes.

## 8. Payment Record Integrity

**PASS** (HIGH priority, fully covered). `paymentRecords` create/update/
delete denied for everyone incl. SA/CM/anon (tested); all mutations flow
through Admin SDK paths proven in Phase 6 (HMAC verify, fetch, webhook,
refund). No client path can set PAID/amount/order/payment/REFUNDED.

## 9. Document Metadata Security

**PASS.** Metadata lives inside staff-read-only `sponsorshipRequests`
docs; anonymous intake writes only `recorded` entries via shape-gated
create; `storageRef` transitions to `ready` exclusively through the
leased backend upload (transactional); no client can reassign references,
mark `verified`, or reach bytes (bytes need staff Bearer + strict ref
shape). `fileUrl` stays null by construction.

## 10. IDOR Analysis

**PASS.** Matrix-tested: non-staff cross-user reads denied; staff reads
intentional; anon reads of intake/docs/ledger denied; forged UID/role
bodies ignored by all backends (Phase 7 matrix); unknown IDs → safe
403/404 without oracles.

## 11. Client vs Server Authority

| Operation | Client write? | Backend write? | Rule | Risk | Result |
|---|---|---|---|---|---|
| Intake creates | Yes (anon, shaped) | Yes (validated) | anon-create gates | Low (admin-view XSS surface only; React-escaped) | PASS |
| Catalogue CRUD | Yes (staff) | No | Role + CM allowlists | Low (last-write-wins among staff) | PASS |
| Workflow + audit | Yes (staff, txn) | No | Append-only audit, transition guards | None found | PASS |
| contentBlocks/siteSettings | Yes (staff) | No | Role/key gates | None found | PASS |
| payments/ledger/capabilities/users-roles | No | Yes (Admin SDK) | Explicit deny or SA-only | None | PASS |
| users bootstrap | Dev-only attempt | Yes (Add Admin) | SA-only | Fails closed | PASS |

No browser↔backend write races exist (disjoint collections/fields).

## 12. Race Condition Analysis

**PASS.** Application/payment idempotency atomic (Phase 1, concurrency-
tested); capability lease + metadata PATCH transactional (Phase 1/4);
workflow transitions in one client transaction; catalogue CMS edits are
last-write-wins among staff (accepted, documented). No counters/sequences.

## 13. Field Integrity

Server-controlled (overwritten or backend-only): `type`, `status`
(intake), `consentGiven`, `antiSpamToken`/`formNonce` (echoed then
overridden), timestamps, `paymentStatus`/`paymentId`/`orderId`/`receipt`,
`storageRef`/`verificationStatus`, `uid`/`role`/`status` (users).
Client-controlled within gates: catalogue copy, CMS text, intake applicant
fields (validated), audit `byUid==self`. Immutable: audit entries,
`users` deletes. `createdAt` client-supplied on intake but overwritten
server-side; on catalogue paths client-controlled (LOW, cosmetic).

## 14. Delete Security

**PASS.** Denied: `users/*` (all roles), `auditLogs/*` (all roles),
`paymentRecords/*` (all roles). Staff-restricted: catalogue, intake,
content (SA/ADMIN; CM never deletes anything — tested). Anonymous: no
delete path anywhere.

## 15. Legacy/Dormant Collection Audit

`sponsorships`, `needsList`: rules-guarded, zero app readers/writers
(verified by repo-wide search) — dormant surface, no data exposure
(anon reads denied, tested for `sponsorships`). PHP-era models fully
removed (Phase 2). No production-data deletion performed or needed.

## 16. Firestore Rule Test Coverage

Was 51; added 22 (73 total, all green): users self/other/anon/SA/ADMIN/
CM/delete matrix, CM injection (mixed + featured) + allowlisted edit,
gallery anon-create + CM-delete, opportunities publish-gate, siteSettings
legal-key + CM-write denials, ledger CM/SA write denials, contactMessages
create/shape/read gates, dormant sponsorships gates, audit append-only.
Uncovered-by-choice: stories-CM-publish breadth (documents intent, no
behavioral lock-in beyond current tests).

## 17. Backend Admin SDK Audit

**PASS.** Zero `body.uid/role/status/owner`-trust patterns in
`backend/src` (searched). All privileged writes use verified-token UID +
`users/{uid}` lookups; references (`recordId`, `ref`) are lookup keys,
never authority; no arbitrary document-read endpoint exists.

## 18. Security Test Matrix

All cells covered: anon (public reads, protected reads denied, shaped
writes allowed, deletes denied); CM (CMS allowlisted writes, users/apps/
payments/docs denied); ADMIN (catalogue/CMS/reads, users-writes denied);
SA (all incl. users management, ledger/docs writes still denied);
cross-user forgery denied; field injection (`role`, `status`, `featured`,
`contactInfo`, `approvalStatus`, `paymentStatus`, `paymentId`) denied.

## 19. Vulnerabilities Found

- Critical: **none.** High: **none.** Medium: **none requiring change**
  (CM stories-publish breadth + dormant collections recorded as
  documented-consistent). Low: dead rule helpers, intake extra-field
  tolerance (admin-view only), client `createdAt` on catalogue paths,
  audit-log self-write spam surface (staff-only, attributed).
  Informational: dev SA-bootstrap fails closed; `previousOrderIds`
  write-only history.

## 20. Fixes Applied

Test-only: new `Phase 8 — data integrity matrix` block (22 tests) in
`front-end/src/test/firestore-rules.test.ts`, incl. one corrected
expectation of mine (staff reads are intentional). Production code:
**ZERO changes** (no vulnerability found; per §18, nothing manufactured).

## 21. Final Verification

- Frontend: typecheck PASS · tests **308/308 (30 files)** · build PASS.
- Backend: typecheck PASS · tests **102/102** · build PASS.
- One run hit the known emulator-init hook race (zero test failures);
  clean rerun recorded. Firestore rules file itself unmodified.

## 22. Remaining Technical Debt

- Consider pruning dead rule helpers + documenting CM stories-publish
  intent with product.
- Decide future of dormant `sponsorships`/`needsList` (code or data).
- Long-run: single-field `users` reads cost double `get()` per rule
  evaluation (perf, not security).

## 23. Production Readiness Notes

Ruleset is default-deny, least-privilege per collection, ledger + users
locked down, intake narrowly shaped, and every claim above is covered by
an emulator test against the exact deployed file. No rule change ships
with this phase.
