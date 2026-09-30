# PHASE 0 — BASELINE AUDIT

> Project: USSCOS website redesign for Ationic. Root: `D:\Client-Website`.
> Phase: BASELINE & ARCHITECTURE FREEZE. Audit-only — no file was modified,
> no package installed, no code fixed. Baselines executed 2026-09-24
> (recorded verbatim in §20). No secret values are printed anywhere in this
> report (variable *names* only).

## 1. Executive Summary

The working tree contains **three overlapping project generations**: the live
`front-end/` + `backend/` pair (React 19 + unified Node/Express backend,
the intended architecture), a legacy `USSCOS/` tree (older Vite app + PHP
payment server + PHP-adjacent docs + 66 documentation files), and a
`front-end.bak/` backup copy. The live pair is coherent and fully green
(typecheck + 263 frontend / 42 backend tests + both production builds pass),
but it carries dead UI, a stale route registry, and one genuine **flow
blocker**: admin accounts are created as email/password accounts while the
login UI supports Google sign-in only, so a newly created admin cannot sign
in. A second structural risk is non-atomic check-then-act sequences
(idempotency, capability consumption, metadata PATCH) that can duplicate or
race under retry/concurrency. PHP is present on disk but completely unwired
from the live request path.

## 2. Current Architecture

**Frontend (`front-end/`, `usscos-app@0.1.0`, ESM):**
React 19.2.8 + ReactDOM 19.2.8 + TypeScript 6.0.3 (sic — see §18) + Vite
8.2.2 + react-router-dom 7.18.3 (BrowserRouter, lazy routes, PublicLayout /
AdminLayout) + @tanstack/react-query 5.102.8 (server cache in hooks) +
react-hook-form 7.87 + Zod 4.5.4 (form schemas) + lucide-react icons.
Forms: hand-rolled wizards (`Apply.jsx`, `AcademyApplication.jsx`,
`Donate.jsx`, `SponsorRequest.jsx`) plus two unrendered RHF forms (see §4).
API communication: `fetch` in service modules (`services/payments/*`,
`services/private-documents.ts`, `services/public-application-submission.ts`,
`services/admin-users.ts`) against `VITE_BACKEND_URL` with legacy per-service
URL fallbacks. Firebase usage: web SDK (`firebase@12.18.0`) for Google Auth +
allowed public Firestore reads; writes for Fighter/Academy go through the
backend. Cloudinary: unsigned uploads for **public gallery/admin media only**
(`services/media/cloudinary.ts`, `VITE_CLOUDINARY_*`). Razorpay: checkout.js
popup driven by server-created `order_id` + server `key_id`, consistency
guard against `VITE_RAZORPAY_KEY_ID`; verification strictly server-side.

**Backend (`backend/`, `usscos-backend@1.0.0`, ESM, Node >= 20):**
Express 4.21 + TypeScript 5.6 (strict) + firebase-admin 12.7 (Auth +
Firestore, initialized once in `src/server.ts` from `FIREBASE_*` env, fail
fast without creds) + Zod 3.23 (server validation) + multer (memory uploads,
10 MB cap) + helmet + cors (exact-origin allowlist, `credentials:true`) +
express-rate-limit (per-surface windows) + dotenv (`.env` loaded first in
`src/server.ts`). Razorpay via direct HTTPS REST (Basic auth), not the SDK.
Private files: `PRIVATE_STORAGE_PATH` on local disk, random `doc_*` names,
mode 0600, no static serving. Webhook: raw-body HMAC-SHA256.

**Contradictions with the intended architecture:** (a) legacy PHP servers
exist but serve nothing (§4); (b) two frontend UI kits (`components/*` +
`components/ui/*`, §4); (c) stale route registry + dead forms (§4–§5);
(d) `@firebase/storage` dependency installed while Storage is intentionally
unused; (e) Zod v4 (frontend) vs v3 (backend).

## 3. Repository Structure

```
D:\Client-Website
├── .git/                        # repo root VCS
├── package.json                 # {"devDependencies":{"typescript":"^7.0.2"}} only
├── package-lock.json
├── node_modules/                # root-level install (typescript only use)
├── backend/                     # LIVE Node backend (own package.json/.env*)
│   ├── src/{app,server}.ts, config/, middleware/, routes/ (4),
│   │   services/ (7), utils/    # 17 source files
│   ├── tests/                   # 4 suites + fakes.ts
│   ├── storage/                 # private uploads (gitignored content)
│   └── dist/                    # compiled output (gitignored)
├── front-end/                   # LIVE React frontend (own .git!)
│   ├── src/{App.jsx,main.jsx} + 15 subdirs (~120 source files)
│   ├── public/, index.html, scripts/update-content-blocks.mjs
│   ├── sharing/private-docs-php/  # legacy PHP docs service (unwired)
│   ├── realsports_project/      # EMPTY directory
│   ├── firebase.json, firestore.rules, storage.rules
│   ├── temp.txt, tmp-academy-run.txt, tmp-run.txt, firestore-debug.log
│   ├── .env (local, gitignored), .env.example
│   └── dist/                    # built site (gitignored)
├── front-end.bak/               # FULL BACKUP COPY (own .git, public/, src/,
│                                # usscos-frontend/, temp.txt, vite.config.js)
├── USSCOS/                      # LEGACY PARALLEL PROJECT (own .git, own .env!)
│   ├── payment-server/php/      # legacy PHP Razorpay server
│   ├── reference/{temp-inspect,usscos (1).zip}
│   ├── documentation/           # 66 markdown files
│   ├── new-project/             # EMPTY directory
│   ├── src/, public/, dist/, node_modules/
│   └── firebase.json, firestore.rules (+.indexes.json), storage.rules
```

## 4. Folder/File Classification

| Path | Appears to do | Referenced? | Necessary? | Conflicts? | Recommendation |
|---|---|---|---|---|---|
| `front-end/` | Live frontend | Yes (all work) | Yes | No | KEEP |
| `backend/` | Live unified backend | Yes | Yes | No | KEEP |
| `front-end.bak/` (+`usscos-frontend/`) | Stale full backup, own VCS | No refs found | No | Yes (drift/confusion) | REMOVE LATER (archive outside repo first) |
| `USSCOS/` | Legacy app + PHP server + docs | No live refs | Docs partially useful | Yes (second Firebase project surface, own `.env`) | REVIEW → REMOVE LATER (keep selected docs) |
| `USSCOS/payment-server/php/` | Legacy PHP Razorpay server | Not in request path | No (ported) | Yes (competing impl on disk) | REMOVE LATER (after sign-off) |
| `front-end/sharing/private-docs-php/` | Legacy PHP docs service | Not in request path | No (ported) | Yes | REMOVE LATER (after sign-off) |
| `front-end/realsports_project/`, `USSCOS/new-project/` | Empty dirs | No | No | Minor | REMOVE LATER |
| `front-end/{temp.txt,tmp-*.txt}`, `*/firestore-debug.log`, `USSCOS/.dev-server.log` | Scratch/debug leftovers | No | No | Minor | REMOVE LATER |
| `front-end/storage.rules` + `USSCOS/storage.rules` | Storage rules for an unused product | Deploy config only | No | Yes — overly broad (`images/**` writable by any signed-in user) if ever deployed | REVIEW (tighten or delete file) |
| `front-end/src/features/sponsorship/{RequestSponsorshipForm,SponsorApplicationForm}.tsx`, `components/domain/needs-list.tsx` | Unrendered RHF forms | Only self/type/test refs | No | Yes (dead UI kit consumers) | REMOVE LATER (or wire/delete decision) |
| `front-end/src/components/ui/*` (16 files) | Second UI kit, used only by the dead forms above (+internally) | Effectively dead in production UI | No | Yes (two kits) | REVIEW → REMOVE LATER with dead forms |
| `front-end/src/constants/{routes.ts,navigation.ts}`, `lib/urlFor.ts` | Stale registry generating unregistered paths (`/groups`, `/stories`, `/become-a-sponsor`, `/request-sponsorship`, `/admin/signin`, `/admin/inbox/*`, …) | `navigation.ts` has no live importer; `urlFor` used — verify call sites | No | Yes | REVIEW → REMOVE LATER |
| `front-end/src/data/pageContent.js` + `siteContent.js` + CMS (`contentBlocks`, `update-content-blocks.mjs`) | Local content + Firestore-overridable copy | Yes (pages/hooks) | Yes | Overlapping sources (merge risk) | KEEP, REVIEW merge |
| Root `node_modules/` + 58-byte `package.json` | Accidental root install | No | No | Minor | REMOVE LATER |
| `backend/{dist,node_modules,storage/*,.env}` | Build/deps/runtime artifacts + local secrets | Runtime | Yes (gitignored) | No | KEEP (ignored) |

## 5. Route Inventory

Registered in `front-end/src/App.jsx` (all verified present). Public (27):
`/` Home, `/about`, `/athletes`, `/athletes/:id`, `/seeking-sponsorship`,
`/apply`, `/apply/academy`, `/sponsorships`, `/sponsorships/opportunities`,
`/sponsorships/provided`, `/sponsorships/athlete/:id`,
`/sponsorships/academy/:academyId`, `/sponsorships/sponsor`, `/news`,
`/news/:id`, `/events`, `/events/:eventId`, `/gallery`, `/donate`,
`/payment/success`, `/contact`, `/faq`, `/terms`, `/privacy`,
`/refund-cancellation`, plus `*` → NotFound. Admin (15 under
`AdminLayout`, any-authorized-session gate): `/admin/login`, `/admin`
→ dashboard, `dashboard, athletes, groups, events, applications,
sponsorships, partners, enquiries, news, gallery, documents, content,
content/:pageId, settings` — 1:1 with `AdminSidebar.jsx` NAV_ITEMS (13 +
dashboard + login) and the 15 `pages/admin/*` files. No registered route
lacks a page; every Navbar/Footer link resolves to a registered route
**except**: footer social icons are dead `<span aria-hidden>` elements
(§16, finding 11 VERIFIED); footer duplicates `/news` twice and `/donate`
twice. `constants/routes.ts` + `ADMIN_ROUTES` describe a *different* app
(`/groups`, `/stories`, `/partners`, `/become-a-sponsor`,
`/request-sponsorship`, `/404`, `/admin/signin|inbox|opportunities|
sport-disciplines|stories|stats-source|team|audit-log|content-health`) —
none registered (finding 10 VERIFIED); `lib/urlFor.ts` builds
`/groups/:slug`, `/stories/:slug`, `/admin/inbox/:kind/:id` — all 404.
`navigation.ts` (dead links incl. `/become-a-sponsor`,
`/request-sponsorship`, `/stories`) has no live importer found.

## 6. API Inventory

Base = `VITE_BACKEND_URL` (fallback legacy `VITE_PAYMENT_SERVER_URL` /
`VITE_PRIVATE_DOCS_URL`). All served from `backend/src/{app,routes/*}`.

| Method | Path | Source | Auth | Role | Rate-limit | Validation | DB effect | External | Caller | Tests |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/health`, `/api/health` | `routes` via `app.ts` | No | — | General 600/15m | — | None | — | Smoke/scripts | — |
| POST | `/api/applications` | `routes/applications.ts` → `services/applications.ts` | No | — | 60/15m | Zod + required-category gate | Create `sponsorshipRequests/{autoId}` (+ merge on retry); create `privateUploadCapabilities/*` | — | `submitPublicApplication` (Apply, AcademyApplication) | `applications.test.ts` |
| POST | `/api/documents/upload-token` | `routes/documents.ts` | No (compat path) | — | 120/15m | app+doc must exist | Create capability | — | `issueApplicationUploadToken` (fallback only) | `documents.test.ts` |
| POST | `/api/documents/upload` (multipart `file`) | same | Capability (`Upload` scheme) | — | 120/15m | ext+magic+10 MB, app/doc binding | Patch `sponsorshipRequests.documents`, delete capability | — | `uploadPrivateDocument` | `documents.test.ts` |
| GET | `/api/documents/:reference` + `/download` | same | Bearer ID token | SA/ADMIN only (CM denied) | 120/15m | strict `doc_*` regex | Read | — | `fetchPrivateDocument` (AdminApplications) | `documents.test.ts` |
| POST | `/api/payments/orders` (+ alias `/order`) | `routes/payments.ts` → `services/payments.ts` | No | — | 120/15m | Purpose/amount/currency/token/key (Zod-ish + Turnstile optional) | Create `paymentRecords/{orderId}`; idempotent reuse | Razorpay REST | `createPaymentOrder` | `payments.test.ts` |
| POST | `/api/payments/verify` | same | No (HMAC proof) | — | 120/15m | Signature/order/amount/currency/captured | `paymentRecords` → PAID | Razorpay fetch | `verifyPayment` | `payments.test.ts` |
| POST | `/api/payments/refund` | same | Bearer ID token | SA/ADMIN only | 120/15m | PAID-only | `paymentRecords` → REFUNDED/PENDING + metadata | Razorpay refund | `requestRefund` (AdminSponsorships) | `payments.test.ts` |
| POST | `/api/payments/webhook` (+ alias `/api/webhooks/razorpay`) | same | HMAC raw body | — | 120/15m | Event allowlist, amount guard | Idempotent transitions | Razorpay events | Razorpay dashboard | `payments.test.ts` |
| POST | `/api/admin/users` | `routes/admin-users.ts` → `services/admin-users.ts` | Bearer ID token | SUPER_ADMIN only | 30/15m | Zod (ADMIN/CM only) | Auth `createUser` + `users/{uid}` set; rollback delete | — | `createAdminUser` (AdminSettings) | `admin-users.test.ts` |

No frontend call targets a nonexistent endpoint; no backend endpoint lacks a
caller (webhook/health are caller-less by nature); no PHP URL is referenced
from `front-end/src` (only `sharing/` + comments); no hardcoded localhost in
runtime code (only `127.0.0.1:8080` in tests, `localhost:5173` as config
fallback, `localhost:3000` in local `.env` files).

## 7. Firebase Architecture

Admin SDK initialized once (`backend/src/server.ts`, fail-fast without
service-account env; never in the browser). Client SDK (`services/firebase.ts`,
lazy getters): Google Auth + allowed public reads.
`firestore.rules` (420 lines, repo = deployed — verified byte-identical
2026-09-20): anonymous create-only on intake collections with shape gates;
all reads staff-only except published catalogue + open content blocks;
`paymentRecords` deny-all-clients (server ledger); `users/{uid}` self-read +
SA-managed.

| Collection | Used by | Readers | Writers | Client/Server | Issue |
|---|---|---|---|---|---|
| `users` | Auth session, backend gates, Add Admin | self + staff | SA client bootstrap; backend | Both | Dev auto-SA create (see §15) |
| `sponsorshipRequests` | Apply flows, Applications inbox/detail | SA/ADMIN | anon create, backend, staff update | Both | None (rules) |
| `sponsorApplications` | SponsorRequest, ledger | SA/ADMIN | anon create, backend | Both | None |
| `contactMessages`, `donationPledges` | Contact, Donate | SA/ADMIN | anon create | Both | None |
| `paymentRecords` | Payments, AdminSponsorships | SA/ADMIN | Backend only | Server | None |
| `privateUploadCapabilities` | Upload capabilities | Backend only | Backend only | Server | No rules entry → default-deny clients (correct) |
| `athletes`, `groups`, `events`, `stories`, `galleryImages`, `partners`, `opportunities`, `sportDisciplines` | Catalogue + admin CRUD | public-if-published + staff | staff (CM copy-limited) | Client | None |
| `needsList` | (legacy list) | public | SA/ADMIN | Client | Possibly unused by UI — REVIEW |
| `siteSettings`, `contentBlocks` | CMS content | public | staff (SA-only deletes) | Client | None |
| `auditLogs` | Workflow audit | SA (+ADMIN own) | staff create-only | Client | None |

## 8. Authentication & Authorization

PUBLIC → `/admin/login` → Google sign-in only (`AdminLogin.jsx` →
`signInWithGoogle`) → Firebase ID token → `watchAuthState` resolves
`users/{uid}` (role + `status==='active'`, `services/auth.ts`) →
`AdminLayout` requires any authorized session (no per-route role split) →
backend `AdminTokenVerifier.verifyIdToken` + `users/{uid}` lookup per call:
`requireStaff` (active SA/ADMIN), `requireSuperAdmin`-equivalent inline in
admin-users (SA only). Roles: SUPER_ADMIN (all + user creation), ADMIN
(manage + refunds + docs), CONTENT_MANAGER (copy-only catalogue; denied
everywhere sensitive). **FLOW BLOCKER (finding 8 VERIFIED):**
`POST /api/admin/users` creates **email/password** Firebase users, but the
login UI offers **Google only** (`AdminLogin.jsx:4,28`; no
`signInWithEmail` anywhere in `src/`) — a newly created admin cannot sign
in until email/password login is added or provisioning switches to Google
accounts. Dev-only escape hatch: `auth.ts syncSession` auto-creates a
temporary `SUPER_ADMIN` user doc in DEV (`import.meta.env.DEV`).

## 9. Fighter Application Flow

`Apply.jsx` (6 steps) → per-step validation + `validateDocuments` (4
required categories) → consent → `buildSponsorshipRequestDoc` (flat field
set, `formNonce` = `crypto.randomUUID`) → `submitPublicApplication`
(`POST /api/applications`) → backend Zod + required-category gate →
`formNonce` lookup → create `sponsorshipRequests/{serverId}` (+ capabilities
for non-ready docs) → `uploadPrivateDocument` per file with its capability →
required-gated success screen + reference ID, or inline error + same-nonce
`RETRY DOCUMENT UPLOAD` (capabilities survive failed attempts; consumed only
on success). Retry of the whole submission returns the existing record.
Gaps: idempotency is lookup-then-create (non-atomic, §21.2); failed-upload
capabilities expire after 15 min with only a generic message.

## 10. Academy Application Flow

`AcademyApplication.jsx` mirrors §9 with `requestFor:'group'`,
`teamFields`, 2 required categories (registration + representative ID),
docs validated at submit. Same backend path, same guarantees/gaps.
Both flows preserve byte-identical Firestore shapes to the legacy direct
write (verified by wizard tests asserting flat `application.*` fields).

## 11. Private Document Architecture

Exactly ONE live architecture (Node). PHP service is dead on disk.
`POST /api/documents/upload-token` (compat/primary issuance happens inside
`/api/applications`): anonymous; requires existing application + known
document id; re-issuable (finding 2 VERIFIED —
`routes/documents.ts` upload-token + `services/capabilities.ts::issueCapability`
have no already-issued check). Guarantees: 256-bit secret, sha256-hash-only
storage, 15-min TTL, single application/document scope, constant-time
compare, consumed (deleted) only after a successful upload + metadata PATCH.
Races (code-reading, not load-tested): concurrent uploads with one
capability can both pass `peek` before either deletes (finding 6 VERIFIED);
metadata PATCH is read-modify-write without transaction (finding 3
VERIFIED); `upload-token` + application retry can orphan capabilities
(unused rows accumulate; no sweeper). No Firebase Storage / Cloudinary path
for private docs anywhere in `src` (only comments + the dead PHP).

## 12. Payment Architecture

Donate / SponsorRequest / (unrendered) SponsorApplicationForm →
`runPaymentFlow` (idempotencyKey = form nonce; `antiSpamToken` = same key) →
server order (`POST /api/payments/orders`, paise math, 1–10,00,000 INR,
Turnstile iff secret set) → Checkout popup with effective key (site key vs
server key mismatch fails closed: `KEY_MISMATCH`) → capture →
`POST /api/payments/verify` (HMAC + fetch + order/amount/currency/captured
checks → PAID; same-payment re-verify idempotent) → receipt in
`sessionStorage` → `/payment/success` (read-only; refresh-safe) →
`payment.captured|failed`, `order.paid`, `refund.*` webhooks reconcile
idempotently (attempt-history dedupe) → refunds SA/ADMIN-only with metadata.
Races: order idempotency is query-then-create (finding 5 VERIFIED —
`services/payments.ts::createOrderFlow`); concurrent same-key orders can
double-create at Razorpay (second Firestore `set` overwrites; single record
survives, orphan Razorpay order possible). No live-secret exposure: only
`key_id`/`VITE_RAZORPAY_KEY_ID` reach the browser.

## 13. Admin Panel Audit

| Page | Route | Roles (UI) | Read/Create/Edit/Delete | Backend | Collections | Tests | Bugs/notes |
|---|---|---|---|---|---|---|---|
| Login | `/admin/login` | Public | Google only | — | `users` (session) | — | Google-only (§8 blocker) |
| Dashboard | `dashboard` | All staff (UI) | Stats read | — | inbox collections | — | No dedicated tests |
| Applications | `applications` | All staff (UI) | Read + workflow transitions | Firestore client rules | `sponsorshipRequests` | admin-documents, approval-workflow | CM sees action buttons; server denies (UI mismatch) |
| Application detail | modal | All staff | Full record + docs VIEW/DOWNLOAD | `/api/documents/:ref` (SA/ADMIN) | same + private store | admin-documents | Charcoal redesign done; CM gets deny message |
| Documents | `documents` | All staff | None (info page) | — | — | — | Placeholder by design (§19.12) |
| Sponsorships | `sponsorships` | All staff | Read ledger + refunds | `/api/payments/refund`, records read | `paymentRecords`, `sponsorApplications` | approval-workflow | CM sees refund UI; server 403s |
| Fighters/Groups/Events/News/Gallery/Partners | catalogue | All staff | Full CRUD (CM copy-limited client-side) | Firestore client rules | respective | write-path/gallery tests | Rules are the real gate |
| Enquiries | `enquiries` | All staff | Read | — | `contactMessages`+ | — | No dedicated tests |
| Content/ContentPage | `content*` | All staff | Upsert (CM allowed), SA-only delete | Firestore client rules | `contentBlocks` | rules tests | — |
| Settings | `settings` | All staff (UI) | Profile/site (local demo), password (demo toast), **Add Admin (real)** | `/api/admin/users` (SA only) | `users` | admin-users (service) | Demo password change shows fake success (see §17); Add Admin visible to non-SA (server 403s) |
| Admin users | (in Settings) | All staff (UI) | Create ADMIN/CM | `/api/admin/users` | `users` | admin-users | List is local-only (no server list endpoint) |

## 14. UI/UX Findings

Charcoal View-Application modal done well; otherwise: footer socials are
dead spans; footer duplicates `/news`, `/donate`; public dynamic pages have
no `<head>` management (no react-helmet dep; static `index.html` meta only —
finding 13 VERIFIED); PageHero images are hotlinked Unsplash `w=1600`
(finding 14 VERIFIED); tables rely on horizontal scroll on mobile (by
design); success/empty/error/loading states exist on all major flows;
role-gated buttons mostly absent (server is the gate); `window.confirm`
used for admin delete; `Add Admin` modal reachable by CM (server rejects).

## 15. Security Findings

No VITE_* secret (scan clean); both `.env` files gitignored (verified);
service account + Razorpay secrets server-only; CORS exact-allowlist +
`credentials:true`; helmet; per-surface rate limits; upload ext+magic+size
gates, `0600`, traversal-proof refs; no stack/secret leakage (dev gateway
detail carries only upstream status/code/description); webhook HMAC over raw
body; Turnstile presence-required, remotely verified only when secret set
(finding 9 VERIFIED — `services/payments.ts::verifyTurnstile` early-return).
Watch items: `storage.rules` allows any signed-in writer under `images/**`
(HIGH if Storage is ever enabled — currently unused); dev auto-SA user-doc
creation in `auth.ts` (MEDIUM — DEV-guarded but writes privilege);
`window.confirm` for deletes (LOW); emulator-only test skips in CI (INFO).

## 16. Performance Findings

Build warns `firebase` chunk 545 KB + `index` 333 KB (route-level lazy
loading exists via `App.jsx`, but Firebase + gallery honk the main chunks —
no manual chunking). Unsplash 1600w heroes on every public page. `listInbox`
caps at 50 with client-side merge, no pagination; catalogue paging exists
(`PAGE_SIZE` 20). react-query caches reads. No image pipeline/blur-up.

## 17. Dead Code / Legacy Code

- Unrendered: `features/sponsorship/RequestSponsorshipForm.tsx`,
  `SponsorApplicationForm.tsx`, `components/domain/needs-list.tsx`
  (LOW — delete with their `components/ui`-only deps).
- `components/ui/*` effectively dead except via the above (REVIEW).
- `constants/routes.ts`, `constants/navigation.ts`, `lib/urlFor.ts`
  (stale registry; MEDIUM — generates 404s if adopted).
- `AdminSettings` demo password change + local profile/website saves show
  success toasts without persistence (MEDIUM — fake success).
- `front-end.bak/`, `USSCOS/`, empty dirs, temp/log files (§4).
- `date-fns` (no importer in `src`), `@firebase/storage` (unused by design),
  `playwright` (no e2e directory found) (LOW).
- Console output: `use-firestore` + adapter + auth error logs only (INFO —
  appropriate); no `alert(` in `src` (only `window.confirm`).

## 18. Dependencies

Frontend prod: `firebase 12.18 (+@firebase/auth/firestore/storage)`,
`react 19.2.8`, `react-router-dom 7.18.3`, `@tanstack/react-query 5.102.8`
(pinned), `react-hook-form 7.87`, `zod 4.5.4`, `lucide-react ^1.38.0`
(version string is anomalous for the lucide line — report as listed),
`date-fns 4.4.0` (unused). Dev: TS 6.0.3 (major 6 — report as listed),
Vite 8.2.2, vitest 4.1.11, eslint 10, `playwright ^1.63` (unused),
`@firebase/rules-unit-testing` (used). Backend: express 4.21, firebase-admin
12.7, zod 3.23.8 (**second Zod major**), multer, helmet, cors,
express-rate-limit, dotenv; dev tsx, vitest, supertest. Root package.json
pins `typescript ^7.0.2` alone (oddity — report as listed).

## 19. Environment Variables

Frontend (`VITE_*`, public by design except none secret): Firebase ×6,
`VITE_ADMIN_ALLOWED_EMAILS`, `VITE_SITE_URL`, `VITE_ENV`,
`VITE_PAYMENT_SERVER_URL` (legacy fallback), `VITE_PRIVATE_DOCS_URL`
(legacy fallback), `VITE_BACKEND_URL` (primary), `VITE_RAZORPAY_KEY_ID`
(public key id), `VITE_CLOUDINARY_CLOUD_NAME/_PRESET`.
Backend (secret): `FIREBASE_PROJECT_ID/_CLIENT_EMAIL/_PRIVATE_KEY`,
`RAZORPAY_KEY_ID/_KEY_SECRET/_WEBHOOK_SECRET`, `PRIVATE_STORAGE_PATH`,
`FRONTEND_ORIGIN`, `PORT`, `NODE_ENV`, optional `TURNSTILE_SECRET`,
`MIN/MAX_AMOUNT_INR`. Problem: none missing; note legacy frontend vars
overlap the unified one (documented fallback, not a bug).

## 20. Test Baseline

Executed 2026-09-24, unmodified suites, Firestore emulator on :8080.

- Frontend typecheck (`tsc -b`): **PASS**, 0 errors.
- Frontend tests (`vitest run`, 25 files): **263/263 PASS**.
- Frontend build (`tsc -b && vite build`): **PASS** (`✓ built`, pre-existing
  >500 kB chunk-size advisory only).
- Backend typecheck (`tsc --noEmit`): **PASS**, 0 errors.
- Backend tests (`vitest run`, 4 files): **42/42 PASS**.
- Backend build (`tsc -p tsconfig.build.json`): **PASS**
  (`dist/server.js` emitted).
- Note: the 2 emulator-backed frontend suites skip cleanly when no emulator
  is present; one transient parallel-init hook timeout was observed and
  passes on rerun (environmental, unrelated to code).

## 21. Critical Findings

1. **Admin login flow blocker (§8).** Created admins (email/password) cannot
   sign in — login UI is Google-only. Nothing in the current code bridges
   this. Must be resolved before any admin onboarding.
2. **Non-atomic idempotency (payments + applications).** Query-then-create
   allows duplicate Razorpay orders / duplicate application records under
   retry/concurrency (`backend/src/services/payments.ts::createOrderFlow`,
   `services/applications.ts::submitApplication`). Financial double-charge
   risk is bounded by same-key reuse returning the first record, but orphan
   gateway orders are possible.
3. **Capability consumption + metadata PATCH races (§11).** Double-spend of
   one-time capabilities and lost-update interleavings are possible under
   concurrency (no transactions).

## 22. High Findings

4. `storage.rules` grants any signed-in writer under `images/**` (dormant
   only because Storage is unused; tighten before any Storage use).
5. Stale route registry + `urlFor` generate unregistered paths; adopting them
   ships 404s (`constants/routes.ts`, `lib/urlFor.ts`).
6. Three project generations on disk (`front-end.bak/`, `USSCOS/`, PHP
   servers) — drift/backdoor-deploy risk; archive then remove.
7. Capability re-issuance without ownership proof beyond IDs
   (`POST /api/documents/upload-token` is anonymous by design compat).

## 23. Medium Findings

8. Demo password change + local profile/website saves show success without
   persisting (`AdminSettings.jsx`).
9. Admin UI exposes all actions to all staff roles (server enforces; UX
   mismatch for CM on refunds/transitions/Add-Admin).
10. Turnstile degrades to presence-check without secret.
11. Zod dual-major (v4 frontend / v3 backend) — keep schemas in sync manually.
12. Footer duplicate links; dead social icons; `window.confirm` deletes.
13. No `<head>`/SEO management on dynamic public pages.
14. `needsList` collection may be unread by any UI.

## 24. Low Findings

15. Unused deps (`date-fns`, `@firebase/storage`, `playwright`), empty dirs,
    temp/log files, root stray `node_modules` + 58-byte `package.json`,
    anomalous version strings (`typescript@6/7`, `lucide-react@1.38`).
16. Unrendered RHF forms + second UI kit; demo toasts; emulator-test skips
    without emulator; bundle-size advisory.

## 25. Recommended Fix Order
1. Resolve the admin login blocker (add email/password sign-in OR provision
   Google accounts; then end-to-end Add-Admin → login test).
2. Make idempotency atomic (Firestore transactions / deterministic
   `paymentRecords/{idempotency-hash}` + `sponsorshipRequests/{formNonce}`
   create-only writes) + capability consume + metadata PATCH in transactions.
3. Tighten/remove `storage.rules`; archive `front-end.bak/` + `USSCOS/` +
   PHP; delete temp files.
4. Remove dead UI kit/forms/registry (or formally adopt), fix footer links,
   gate admin UI by role for parity with the server.
5. Add `<head>`/SEO basics, image pipeline, manual chunking, inbox
   pagination; prune unused deps; align Zod majors.

## Appendix A — Verdicts on the 14 Items Flagged for Verification

1. Backend application schema may use permissive `.passthrough()`.
   VERIFIED — `backend/src/services/applications.ts:39` (`application`
   object uses `.passthrough()`; unknown applicant fields persist verbatim).
2. `/api/documents/upload-token` may allow capability regeneration.
   VERIFIED — `backend/src/routes/documents.ts` (upload-token handler) +
   `services/capabilities.ts::issueCapability` perform no already-issued
   check; repeated calls mint fresh capabilities for the same document.
3. Document metadata updates may have concurrent-write problems.
   VERIFIED — `services/documents.ts::uploadDocument` does read-modify-write
   of the `documents` array via plain `gateway.update` (no transaction).
4. Application idempotency may not be atomic.
   VERIFIED — `services/applications.ts::submitApplication` does
   query-by-`formNonce` then create (no transaction).
5. Payment idempotency may not be atomic.
   VERIFIED — `services/payments.ts::createOrderFlow` does query-by-
   `idempotencyKey` then Razorpay-create + set (no transaction).
6. Capability consumption may not be atomic.
   VERIFIED — `services/documents.ts::uploadDocument` peeks, stores the
   file, patches Firestore, then deletes the capability; concurrent uploads
   can both pass peek before either delete.
7. Old PHP private-document architecture may still exist.
   VERIFIED — `front-end/sharing/private-docs-php/` (full service) and
   `USSCOS/payment-server/php/` exist on disk but serve no live traffic.
8. Admin account creation may use email/password while login may use Google.
   VERIFIED — `backend/src/services/admin-users.ts` creates email/password
   users; `front-end/src/pages/admin/AdminLogin.jsx:4,28` offers Google
   sign-in only (no `signInWithEmail` in `src/`). FLOW BLOCKER.
9. Turnstile may not be enforced when secret is absent.
   VERIFIED — `backend/src/services/payments.ts::verifyTurnstile` path in
   `createOrderFlow` skips remote verification when `turnstileSecret` is
   empty (presence of `antiSpamToken` still required).
10. Route registry may differ from actual router.
    VERIFIED — `front-end/src/constants/routes.ts` (+ `navigation.ts`,
    `lib/urlFor.ts`) reference ~15 paths absent from `src/App.jsx`.
11. Footer social icons may not actually be links.
    VERIFIED — `front-end/src/components/public/Footer.jsx:61-67` renders
    dead `<span aria-hidden>` elements with no href.
12. Admin Documents may be a placeholder rather than a complete
    document-management feature.
    VERIFIED — `front-end/src/pages/admin/AdminDocuments.jsx` is an
    informational page (states this explicitly); management happens inline
    in the application detail modal.
13. Public dynamic pages may have SEO limitations.
    VERIFIED — no head/meta manager dependency in
    `front-end/package.json`; per-page metadata is absent (static
    `index.html` only).
14. External image URLs may be used instead of production-managed assets.
    VERIFIED — hotlinked Unsplash `images.unsplash.com` heroes in
    `PageHero` usages (e.g. `Donate.jsx`, `PaymentSuccess.jsx`,
    `HeroSlideshow.jsx`, apply pages).
