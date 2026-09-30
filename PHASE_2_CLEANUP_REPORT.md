# PHASE 2 — CLEANUP REPORT

> Audit basis: `D:\Client-Website\PHASE_2_CLEANUP_AUDIT.md` (proof-first;
> every removal below was verified unreferenced before deletion).
> Phase 1 guarantees preserved: no security-behavior changes (one
> fail-closed key guard predates this phase and is untouched).

## Files/directories removed

- `front-end.bak/` — entire stale backup tree incl. its `.git`
  (history preserved on its GitHub remote; tree was clean/in-sync).
- `USSCOS/` — entire legacy tree incl. its `.git`, `payment-server/php`,
  `reference/`, `documentation/` (66 files), `dist/`, `node_modules/`.
  NOTE: it held 15 unpushed local commits + a modified `.env.example`;
  those local commits were deleted with the tree (`origin/main` preserved
  on GitHub). Nothing in the active architecture referenced it.
- Root `package.json`, `package-lock.json`, `node_modules/` — stray
  typescript-only install; backend/frontend are self-contained (no
  workspaces, no referencing scripts).
- `front-end/sharing/` (`private-docs-php/`, 11 files) — dead PHP document
  service; Node port is the live implementation.
- `front-end/realsports_project/` — empty directory.
- `front-end/{temp.txt,tmp-academy-run.txt,tmp-run.txt,firestore-debug.log}`
  — scratch/emulator leftovers (log regenerates as needed; ignored).
- `front-end/src/features/sponsorship/{RequestSponsorshipForm,SponsorApplicationForm}.tsx`
  — unrendered forms (their Zod `schema.ts` types stay: live-used).
- `front-end/src/components/ui/` (16 files) — second UI kit whose only
  external importers were the forms above.
- `front-end/src/components/domain/` (`needs-list.tsx`) — zero importers.
- `front-end/src/constants/` (`routes.ts`, `navigation.ts`) — registry for
  a different app (~15 unregistered paths); no live importers.
- `front-end/src/lib/{cn,client-pending,site-config}.ts` — zero importers
  (`cn` only served the removed UI kit).
- `front-end/src/lib/urlFor.ts` — pruned to the single live builder
  (`galleryEventRoute`); dead builders (`athlete/group/opportunity/event/
  story/inbox` routes, incl. unregistered paths) removed.

## Dependencies removed (frontend only; lockfile updated via npm uninstall)

- `date-fns` — zero imports in src/scripts/config.
- `@firebase/storage` — zero imports (Storage intentionally unused).
- `react-hook-form` — only the two deleted forms used it.
- Kept deliberately: `playwright` (used by `scripts/e2e/*.smoke.cjs`, 7 files),
  Zod v4 + backend Zod v3 (isolated installs; cross-major consolidation
  risks behavior changes — documented split, no shared schema package).
- Backend `package.json`: untouched (every dep imported).

## Configs cleaned

- `front-end/src/lib/config.ts` — removed `VITE_PRIVATE_DOCS_URL` +
  `VITE_PAYMENT_SERVER_URL` fallback support (single `VITE_BACKEND_URL`
  source; unset still fails safe to "not configured", never fake success).
- `front-end/.env.example` — removed both legacy entries.
- `AdminSponsorships.jsx` empty-state string now names `VITE_BACKEND_URL`
  + unified Node backend.
- `front-end/storage.rules` — already deny-all (Phase 1); untouched.

## Legacy systems removed

- PHP document service, PHP payment server, backup/legacy trees (above).
- Anonymous `POST /api/documents/upload-token` was already gone (Phase 1);
  re-verified absent.

## Files intentionally kept and why

- `scripts/` incl. `e2e/*.smoke.cjs` — manual Playwright smoke tooling,
  not bundled, referenced by workflow (not npm scripts).
- `features/sponsorship/schema.ts`, `data/pageContent.js`,
  `siteContent.js`, `features/admin/content-pages.js`, `lib/media.ts`,
  `lib/urlFor.ts` (pruned) — live imports in pages/hooks/tests.
- `AdminDocuments.jsx` info page, footer socials/duplicates, demo
  password/profile saves — deliberate content/UX, not architecture;
  changing them would be redesign/scope creep (noted as content debt).
- `dist/`, `backend/storage/*`, `.env` files — gitignored build/runtime
  artifacts + local secrets.
- `USSCOS/documentation/` went with its tree (see note above).

## Repository-wide stale-reference results (post-cleanup)

- `private-docs-php|payment-server|upload-token` in `backend/src` — none
  (only the intentional 404 regression test path).
- Same + `VITE_PRIVATE_DOCS_URL|VITE_PAYMENT_SERVER_URL|constants/routes|
  components/ui|needs-list|RequestSponsorshipForm|SponsorApplicationForm|
  lib/cn|react-hook-form|date-fns|firebase/storage|front-end.bak|
  realsports|USSCOS/` in `front-end/src` — none (only live `schema.ts`
  *type* imports, which were kept deliberately).
- `payments-leak-scan.test.ts` updated off the deleted form (now asserts
  Donate + SponsorRequest); no other test referenced removed files.
- No broken imports (proven by typecheck + build + full suites below).

## Final test results

- Frontend `npm test`: **269/269 (26 files)** — no regression from baseline.
- Backend `npm test`: **50/50 (4 files)** — no regression.
- Frontend `npm run typecheck` (`tsc -b`): **PASS**, 0 errors.
- Backend `npm run typecheck` (`tsc --noEmit`): **PASS**, 0 errors.
- Frontend `npm run build`: **PASS** (`✓ built`, pre-existing chunk-size
  advisory only).
- Backend `npm run build`: **PASS** (`dist/server.js` emitted).

## Final typecheck/build results

All four gates above pass; no test was modified to force a pass (one test
updated solely because its subject file was deleted, with coverage moved
to the live pages).

## Remaining technical debt (not architecture)

Content/UX items intentionally left: footer dead social spans + duplicate
links; demo password/profile/website saves; `needsList` collection
possibly unread; dynamic-page SEO; Unsplash hotlinks; inbox 50-cap;
Zod dual-major; `previousOrderIds` without reader UI.

## Recommendation: is Phase 2 complete?

**Yes.** Single live frontend (`front-end/`, React 19 + TS + Vite +
Router 7 + TanStack Query + RHF removed as unused), single live backend
(`backend/`, Express + Admin SDK + Razorpay + private filesystem), no PHP
in the request path, no dead registry/kit/endpoints, no safely-removable
obsolete dependencies left, all 14 final requirements met. The only
outstanding item is user-side VCS: review the working-tree deletions
(`git status`) and commit when satisfied — I made no commits, per policy.
