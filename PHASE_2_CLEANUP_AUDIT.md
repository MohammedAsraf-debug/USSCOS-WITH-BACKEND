# PHASE 2 — CLEANUP AUDIT (proof-first, concise)

> Methods: recursive listings, repo-wide import/reference greps over
> `front-end/src|scripts|*.json|*.ts`, `backend/src|tests|*.json`, sibling-path
> search, git tracking + remotes, package scripts. Nothing deleted before this
> record. Secrets never printed.

## Decisions

| # | Candidate | Why obsolete | Search result | Referenced? | Decision / reason |
|---|---|---|---|---|---|
| 1 | `front-end.bak/` (whole tree incl. own `.git`) | Stale backup generation, own remote `realsports_project` | No import/path/config/script reference from active code; `git status` clean, in sync with its origin | No | **REMOVE** working tree (history preserved on its GitHub remote) |
| 2 | `USSCOS/` (whole tree incl. own `.git`) | Legacy parallel app + PHP server | Zero references from active code/config/scripts; own remote exists | No | **REMOVE** working tree — NOTE: `git status` shows ahead-15 + modified `.env.example`, i.e. 15 unpushed local commits are deleted with the tree (remote `origin/main` preserved) |
| 3 | Root `package.json`, `package-lock.json`, `node_modules/` | 58-byte manifest (typescript-only), tracked install | No `workspaces`, no script references it, backend/frontend self-contained | No | **REMOVE** all three (untracked-state change; user commits when ready) |
| 4 | `front-end/sharing/private-docs-php/` | Dead PHP docs service; Node port is live | No src/script/config refs (only its own README/sample + audit docs) | No | **REMOVE** |
| 5 | `front-end/realsports_project/`, `USSCOS/new-project/` | Empty dirs | Nothing to reference | No | **REMOVE** (latter goes with #2) |
| 6 | `front-end/{temp.txt,tmp-academy-run.txt,tmp-run.txt,firestore-debug.log}` | Scratch/emulator leftovers | Not imported; `firestore-debug.log` regenerates on emulator runs (gitignored? verify) | No | **REMOVE** files (log will regenerate as needed) |
| 7 | `front-end/src/features/sponsorship/{RequestSponsorshipForm,SponsorApplicationForm}.tsx` | Unrendered RHF forms (no page imports either) | Only self + type-only schema imports | No | **REMOVE** (keep `schema.ts`: types live-used by adapter/tests) |
| 8 | `front-end/src/components/ui/` (16 files) | Second UI kit; external importers are only #7 + #9 | No live/test imports outside #7/#9 + internal | No | **REMOVE** dir |
| 9 | `front-end/src/components/domain/needs-list.tsx` (+dir) | No importers anywhere | None found | No | **REMOVE** file + dir |
| 10 | `front-end/src/constants/{routes,navigation}.ts` (+dir) | Registry describes a different app (`/groups`, `/stories`, `/admin/signin`, …); nothing live imports them | `navigation.ts`: zero importers; `routes.ts`: imported only by `navigation.ts` + `lib/urlFor.ts` (dead builders) | No (live) | **REMOVE** both + dir; prune `lib/urlFor.ts` to live `galleryEventRoute` |
| 11 | `front-end/src/lib/{cn,client-pending,site-config}.ts` | Zero importers (`cn` only via #8/#9) | None found | No | **REMOVE** |
| 12 | `date-fns`, `@firebase/storage`, `react-hook-form` (fe deps) | No imports in src/scripts/config (RHF only in #7) | Confirmed zero usage | No | **REMOVE** via `npm uninstall` (lockfile updated) |
| 13 | `playwright` (fe devDep) | Used by `scripts/e2e/*.smoke.cjs` (7 files) | Referenced | Yes | **KEEP** (+ keep `scripts/`) |
| 14 | Zod v4 (fe) vs v3 (be) | Separate installs, no shared schema package; major-version behavior risk both directions | N/A | N/A | **KEEP both, document** |
| 15 | `VITE_PRIVATE_DOCS_URL` + `VITE_PAYMENT_SERVER_URL` fallback code + `.env.example` entries + admin string | Legacy per-service vars; unified `VITE_BACKEND_URL` is live; user env already backend-only | `config.ts` fallback + example + 1 UI string | Obsolete | **REMOVE** fallback support (fail-safe: unconfigured state, no fake success) |
| 16 | `POST /api/documents/upload-token` | Removed Phase 1; regression test asserts 404 | Only the 404 test references the path | No (by design) | **Already gone — verify zero refs** |
| 17 | Footer social spans + duplicate links | Content choices, not architecture; task forbids footer redesign | N/A | N/A | **KEEP**, note as content debt |
| 18 | `AdminSettings` demo password/profile/website saves | Placeholder UX, live page | N/A | N/A | **KEEP** (removal = UI scope creep), note as debt |
| 19 | `AdminDocuments.jsx` info page | Deliberate, accurate | N/A | N/A | **KEEP** |
| 20 | `front-end/dist/`, `backend/dist/`, `backend/storage/*`, `.env` files | Gitignored build/runtime artifacts + local secrets | N/A | N/A | **KEEP** (check gitignore) |
| 21 | `USSCOS/documentation/` (66 files) | Goes with #2 | N/A | No (live) | **REMOVE** with tree |
| 22 | `data/pageContent.js`, `siteContent.js`, `features/admin/content-pages.js`, `scripts/update-content-blocks.mjs`, `lib/media.ts` | Live CMS/data paths (hook + pages + tests import them) | Referenced | Yes | **KEEP** |
| 23 | `storage.rules` (deny-all), `backend/.env.example` | By design / documented | N/A | N/A | **KEEP** |

## Pre-deletion verification checklist (run before/after)

- `git status` reviewed; nested remotes recorded (front-end→USSCOS,
  backend→USSCOS-WITH-BACKEND, bak→realsports_project, USSCOS→USSCOS).
- No `../USSCOS`, `private-docs-php`, `payment-server`, `front-end.bak`,
  `realsports_project` references in active code/config/scripts.
- `payments-leak-scan.test.ts` reads `SponsorApplicationForm.tsx` → update
  test when deleting #7 (drop its assertions, keep Donate ones).
- After deletions: repo-wide sweeps (PHP refs, upload-token, legacy vars,
  dead imports) + fe/be tests + typechecks + builds.
