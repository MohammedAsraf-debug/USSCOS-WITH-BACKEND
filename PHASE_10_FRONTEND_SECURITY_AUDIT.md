# PHASE 10 — FRONTEND SECURITY & CLIENT-SIDE ATTACK-SURFACE AUDIT

> Scope: React/Vite browser app only. One HIGH fix + one hardening header;
> no redesigns, no backend/rules/auth/payment changes.

## 1. Scope

Full `front-end/src/**` + `public/**` + Vite config + env handling + build
output swept for DOM/XSS, navigation, storage, postMessage, externals,
secrets, debug surface, and every auth/admin/payment/document/CMS flow.

## 2. Frontend Attack-Surface Inventory

27 public + 15 admin routes; 4 wizards + donation/sponsor/payment flows;
services call Node backend (`VITE_BACKEND_URL`) + Firebase client SDK
(Auth/reads) + Razorpay checkout.js + Cloudinary unsigned uploads;
Firestore reads via allowlisted queries; writes only intake creates +
staff catalogue/CMS ops; storage = payment receipt (sessionStorage) +
Firebase SDK persistence; zero `postMessage`/`window.open`, zero
localStorage/cookies/IndexedDB app code, zero analytics.

## 3. Environment / Secret Exposure

**PASS.** `VITE_*` holds only public-by-design config (Firebase web keys,
backend URL, test key ID, Cloudinary cloud/preset); verified no
`*SECRET*`/`*PRIVATE_KEY*` in `src`; production `dist/` scanned: no
private keys, Razorpay/webhook/Turnstile secrets, or service-account
material; no `.map` files emitted (sourcemaps off by default config).

## 4. Authentication Client Security

**PASS.** Google + email/password both funnel through one
`syncSession`→`users/{uid}` resolver; null session = denial everywhere;
passwords go straight to the Firebase SDK, cleared from state, never
stored/logged/URL-carried; friendly error mapping leaks nothing;
ID tokens only in `Authorization` headers; refresh SDK-managed.
Forged role/uid/status in client state cannot reach the backend (server
re-resolves everything — Phase 7 matrix).

## 5. Admin Route Security

**PASS.** `AdminLayout` gates on live session (loading renders neither
login nor dashboard); unauthenticated → login; logout → session cleared +
login; direct URLs guarded; lazy admin chunks carry no data (hooks fetch
post-mount under the same guard). Sidebar visibility is UX-only.

## 6. XSS / DOM Security

**One HIGH found and fixed** (see §24): staff-authored story bodies
rendered raw in `NewsDetail`. Every other rich-text path
(`renderRichText`, excerpts, titles, applicant/admin data, filenames,
toasts) is React-escaped text. No other `innerHTML`/`eval`/`Function`/
string-timers/data-URLs sinks exist (swept).

## 7. URL / Navigation Security

**PASS.** ~120 internal targets resolve to registered routes; CMS-driven
destinations pinned (Phase 3); dynamic IDs encoded; query params
(`type/athlete/academy/event`) consumed as data, never as routes;
`registrationUrl`/view-links are plain anchors to staff data (no router
involvement, no javascript: vector — React blocks those schemes).

## 8. External Link Security

**PASS** (+ regression test). All 3 `target="_blank"` anchors carry
`rel` (`noopener`/`noreferrer`); no `window.open`; new source-scan test
fails the build if a future anchor omits it.

## 9. postMessage / Window Security

No `postMessage`/`message`/`opener`/`parent`/`top` usage anywhere in
`src` — **no postMessage attack surface exists**. Razorpay checkout uses
its own popup flow, not our messaging.

## 10. Storage / Cookie Security

**PASS.** App storage = one shape-validated payment receipt in
`sessionStorage` (no PII beyond donor-facing receipt fields, no secrets,
refresh-safe by design). No passwords/tokens/bytes persisted by app code;
Firebase SDK persistence (IndexedDB/local) is SDK-managed auth state —
distinguished here, not app data. No cookies set by the app.

## 11. Payment UI Security

**PASS.** Checkout opens only with server order + consistent key
(mismatch fails closed); capture handler requires all three Razorpay
fields; success renders only shape-validated verified receipts (direct
visit/tamper/refresh covered by tests); failure/dismiss paths never
navigate to success; retry reuses the server order key.

## 12. Document / File UI Security

**PASS.** No filesystem paths reach the browser (`storageRef` opaque IDs
only, never rendered — asserted); filenames React-escaped; previews use
revoked Blob URLs (`iframe` PDF / `img`) of server-MIME-gated bytes
(PDF/JPG/PNG by magic bytes — no HTML/SVG execution context); downloads
via Blob + server filename; VIEW/DOWNLOAD require staff session + server
authorization per file.

## 13. Form Security

**PASS.** Client validation is gate-keeping only (server Zod
authoritative); no hidden-field trust (builders pick explicit fields);
submit buttons disable in flight (double-submit tested); logout/form
transitions don't carry sensitive values; email-login password cleared
after every attempt (tested).

## 14. CMS / Untrusted Content

**PASS** after fix. All CMS copy renders escaped except the one fixed
sink (§6/§24). Attack payloads verified stripped: `<script>`,
`<img onerror>`, `javascript:` hrefs, `<svg/onload>`, iframes,
`data:text/html`. Formatting subset (`p/br/strong/em/lists/links/
headings/quotes`) preserved.

## 15. API Response Trust

**PASS.** UI treats role/status/ownership/payment/document states as
display hints; every privileged action re-verified server-side (refunds,
doc access, user creation, workflow transitions all 401/403 without a
valid authorized session — Phase 7 matrix).

## 16. Error / Data Leakage

**PASS.** Console usage is error-only diagnostics (no PII beyond error
objects, client-side only); toasts show safe static/server messages;
no tokens/headers/passwords/keys/paths/stack traces in UI or logs.

## 17. Source Maps / Build Artifacts

**PASS.** No `.map` files in `dist/`; dev-preview module ships but is
triple-gated inert in production (`DEV` + `VITE_ENV=dev` + Firebase
disabled); no test credentials or mock data bundled (mocks live in
`src/test`, excluded from the app graph — verified via bundle scan
showing only app + vendor code paths).

## 18. Dependency Security Surface

No HTML/markdown/sanitization libs existed (hence bespoke `**bold**`
renderer — safe by construction). Added `dompurify@3.4.16` (+ types, dev)
solely for the §24 fix — actively maintained, no CVEs in the vendored
version per `npm audit` (only unrelated advisories). No auth/payment/file
lib changes. No dangerous outdated packages identified for this surface.

## 19. Debug / Development Surface

**PASS.** Dev preview requires all three dev conditions; AdminLogin debug
UID block renders only when preview available; no test endpoints, no
`?debug` paths, no bypass logins reachable in production builds.

## 20. Third-Party Content / Embeds

Google Fonts (static), Unsplash images (decorative `<img>`), Razorpay
`checkout.js` (fixed URL, server order-bound), Cloudinary unsigned media
(`<img>`/`<video>` — no script context), Google Maps embed (fixed host,
encoded address). No dynamic script/iframe URLs anywhere (swept).

## 21. Clickjacking / Frame Behavior

Backend sends `X-Frame-Options: SAMEORIGIN` (API). Site pages previously
sent no frame policy → added `public/_headers` (`SAMEORIGIN`,
`nosniff`, strict referrer). Same-origin framing unaffected; nothing in
the app requires cross-origin framing (previews use Blob URLs).

## 22. Accessibility vs Security

Hidden/disabled controls (sidebar drawer, disabled submit/retry buttons,
`aria-hidden` socials) carry no authorization weight — server decides
(verified per surface in Phase 7). No change.

## 23. Security Tests

New: `article-sanitize.test.ts` (5 payload cases), `newsdetail-xss.test.tsx`
(end-to-end sanitized render), `external-navigation.test.ts` (static
`rel` guard). Existing XSS-adjacent coverage kept green
(`private-docs-access` no-URL assertions, payment receipt validation).

## 24. Vulnerabilities Found

- **HIGH (fixed): stored XSS via story body** — any staff role with
  story-write (incl. CONTENT_MANAGER, full update per rules) could persist
  arbitrary HTML/JS executed for every visitor of `/news/:id`
  (`NewsDetail.jsx` raw `dangerouslySetInnerHTML`, plain-textarea authoring,
  `z.string().nullish()` with no sanitization anywhere in the path).
  Fix: `src/lib/sanitize.ts` (DOMPurify, tight formatting-only allowlist)
  applied at the single sink; plain-text bodies still render escaped.
- **LOW (fixed): missing frame policy on site pages** — `public/_headers`
  added (SAMEORIGIN + nosniff + strict referrer).
- Informational: videos use CMS/Cloudinary URLs (no script context);
  console diagnostics client-side only; dev-preview ships inert.

## 25. Fixes Applied

`src/lib/sanitize.ts` (new), `NewsDetail.jsx` (sanitize at sink),
`public/_headers` (new), `dompurify` + `@types/dompurify` (new focused
dep), 3 test files above. Nothing else touched.

## 26. Final Verification

- Frontend: typecheck PASS · tests **316/316 (33 files)** · build PASS.
- Backend: typecheck PASS · tests **113/113** · build PASS (untouched).
- One full-suite run hit machine resource exhaustion (worker start
  failures, zero assertion failures); clean rerun recorded.

## 27. Remaining Technical Debt

- Consider server-side HTML sanitization on story write as defense in
  depth (render-time gate is complete and sufficient alone).
- `rel` on `target=_blank` relies on the new static guard (no runtime risk).
- CSP header intentionally not added (would need bundle/script-hash
  design — separate phase if desired).
