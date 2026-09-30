# PHASE 3 — ROUTING & NAVIGATION AUDIT

> Scope: routing/navigation only. No redesign, no architecture changes.
> Source of truth: `front-end/src/App.jsx` (React Router 7 tree).

## Actual route inventory

Public (27, all with pages): `/`, `/about`, `/athletes`, `/athletes/:id`,
`/seeking-sponsorship`, `/apply`, `/apply/academy`, `/sponsorships`,
`/sponsorships/opportunities`, `/sponsorships/provided`,
`/sponsorships/athlete/:id`, `/sponsorships/academy/:academyId`,
`/sponsorships/sponsor` (+`?type=&athlete=|academy=` query params),
`/news`, `/news/:id`, `/events`, `/events/:eventId`, `/gallery`
(+`?event=` filter), `/donate`, `/payment/success`, `/contact`, `/faq`,
`/terms`, `/privacy`, `/refund-cancellation`, `*` → `NotFound`.
Admin (15, under `AdminLayout`): `/admin/login`, `/admin` → dashboard,
`dashboard, athletes, groups, events, applications, sponsorships, partners,
enquiries, news, gallery, documents, content, content/:pageId, settings` —
1:1 with sidebar items and `pages/admin/*` files.

## Navigation audit results

- ~120 internal targets swept (`Link`/`NavLink`/`navigate()`/buttons/cards/
  CTAs/sidebar/redirects): **all resolve to registered routes**.
- No stale-registry dependency remains (removed Phase 2); no `constants/
  routes` resurrection; `lib/urlFor.ts` holds only the live
  `galleryEventRoute` (used by `EventDetail`).
- Raw `<a href>` internal links (consent privacy links, dashboard shortcuts)
  work via full reload — left as-is (not broken).
- External destinations correct: `mailto:`/`tel:`, `page.route` view-links
  (local CMS registry), blob-download anchors, Razorpay checkout.js.
- Parameterized routes: IDs passed encoded; unknown IDs degrade to
  `EmptyState` not-found views (`AthleteProfile`, `NewsDetail`,
  `AcademyDetails`, `EventDetail` all verified).
- `/404` CMS entry falls through to the `*` NotFound page (works).

## Stale route findings

None remaining in code. One live-data hazard found + fixed (below).

## Deep-link findings

`public/_redirects` (`/* /index.html 200`) covers SPA fallback on Netlify.
Deep links verified in-test via initial entries (`/donate`,
`/athletes/:id`, `/payment/success`, unknown path).

## 404 findings

Intentional `NotFound` page exists and renders for unknown paths (verified —
renders 404 content, never an unrelated page).

## Admin protection findings

`AdminLayout` gates on any authorized session; unauthenticated →
`/admin/login`; `/admin` index → dashboard; logout → login; login
auto-forwards an existing session (no loops). Role split stays
server-side (UI shows all sections to all staff — pre-existing, unchanged).

## Auth redirect findings

Google + email/password both resolve through `users/{uid}` role session
before navigating; null session stays on login with a safe error; sign-out
returns to login. No loops found.

## Payment/application routing findings

Checkout opens only from Donate/SponsorRequest via `runPaymentFlow`;
verified-`PAID` alone writes the `sessionStorage` receipt that
`/payment/success` renders (refresh-safe, no re-payment); failures stay
in-form with same-key retry. No misleading-success URL exists
(no-receipt visits show the fallback state).

## Fixes made

1. **`SponsorshipsHub.jsx`** — panel destinations pinned to the hardcoded
   META table (`/sponsorships/sponsor`, `/seeking-sponsorship`, `/donate`).
   Before, `{...META, ...cmsItem}` let staff-editable CMS content override
   `to`, creating dead routes or an external open-redirect through
   `navigate()`. CMS copy fields (title/text/linkLabel) still apply.
   Single confirmed routing defect; nothing else was broken.

## Tests added/changed

- New `src/test/routing.test.tsx` (6): direct `/donate` render, unknown →
  NotFound, unauthenticated `/admin/dashboard` → `/admin/login`,
  authorized session admitted without loops, direct `/payment/success`
  with receipt, unknown athlete id → not-found state.
- New `src/test/cms-navigation-guard.test.tsx` (2): CMS `to` override
  (external URL + dead route) ignored; panels land on registered routes.
- No existing tests modified.

## Final verification results

- Frontend: typecheck PASS · tests **277/277 (28 files)** · build PASS
  (`✓ built`, pre-existing chunk advisory only).
- Backend: typecheck PASS · tests **50/50** · build PASS (untouched, still green).
- Files created: `routing.test.tsx`, `cms-navigation-guard.test.tsx`,
  this doc. Files modified: `SponsorshipsHub.jsx` (destination pinning
  only). Files deleted: none.

## Remaining routing-related debt

- Raw-anchor internal links (consent, dashboard shortcuts) cause full
  reloads — functional, could become `<Link>` later.
- CMS arrays elsewhere are copy-only today, but any future CMS-driven
  destination should follow the META-pinning pattern.
- Role-based admin nav hiding (CM sees all sections; server denies) —
  UX parity item, not a routing bug.
