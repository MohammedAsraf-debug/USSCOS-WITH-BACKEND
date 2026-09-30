# PHASE 4 — PRIVATE DOCUMENT ARCHITECTURE AUDIT

> Scope: private documents only. Phase 1 guarantees preserved and re-verified;
> no UI redesign, no auth/payment/routing changes.

## 1. Current document architecture

`Apply/AcademyApplication.jsx` → `submitPublicApplication`
(`POST /api/applications`) → `uploadPrivateDocument(file, target, capability)`
(`POST /api/documents/upload`) → `downloadDocument`/`fetchPrivateDocument`
(`GET /api/documents/:reference[/download]`, staff Bearer). Admin review
inline in `AdminApplications.jsx` (VIEW/DOWNLOAD via Blob URLs; `storageRef`/
`fileUrl` never rendered — asserted by `admin-documents.test.tsx`).
`AdminDocuments.jsx` is intentionally an info page (no change).

## 2. Upload lifecycle

Validate presence → server-side file check (ext + magic + ≤10 MB) → claim
lease (txn) → application/entry lookup → write `0600` file → transactional
metadata PATCH → consume capability. Any post-claim failure releases the
lease and removes partial bytes; pre-claim failures touch nothing.

## 3. Capability lifecycle

CREATE (with application, hash-only store) → CLAIM (transactional,
single-winner lease, 5-min stale takeover) → UPLOAD → METADATA UPDATE →
CONSUME on success / RELEASE on failure → EXPIRY (15 min, 410). No recovery
endpoint exists (`upload-token` → 404, regression-tested). Cross-app,
cross-doc, malformed, expired, and reused tokens all rejected without side
effects (tested).

## 4. Filesystem storage design

`PRIVATE_STORAGE_PATH` (default `./storage/private`, outside any served
tree; backend serves zero static files). Random `doc_<48hex>.<ext>` names —
original filenames never touch the disk. Strict `doc_*` shape gate on every
resolve/download/unlink path (traversal impossible; `..`, absolute paths,
wrong extensions → 404). Mode `0600` (best-effort chmod).

## 5. Metadata design

Per-document entries inside `sponsorshipRequests/{id}.documents`: `id`,
`documentCategory`, `documentType`, `fileName`, `fileSizeBytes`,
`fileType` (server-sniffed MIME), `storageRef`, `fileUrl: null`,
`status` (`recorded`→`ready`), `uploadedAt`, `verificationStatus`.
No bytes, no absolute paths, no storage internals in Firestore. Field names
unchanged.

## 6. Download authorization

`requireStaff` (verified ID token + active SA/ADMIN `users/{uid}`; CM
denied) runs BEFORE any filesystem touch; anonymous → 401, wrong role →
403, bad reference/missing file → identical 404 (no existence oracle).
Bytes stream with inline/attachment disposition; paths never exposed.

## 7. Admin document status

Fully functional inline review (VIEW/DOWNLOAD/verification display) inside
the application detail modal; standalone Documents page is an intentional
overview, not a manager. No new admin UI built (out of scope).

## 8. Legacy paths found/removed

None remaining: repo-wide sweeps for `upload-token` (only the 404 test),
PHP (`sharing/` removed Phase 2), `VITE_PRIVATE_DOCS_URL`, Storage SDK
usage, and static serving are all clean. `@firebase/storage` remains only
as an untouchable transitive dep of the `firebase` client package.

## 9. Security tests

Covered (backend `documents.test.ts` + frontend `private-docs-access`):
anon/CM denied, traversal battery, magic-vs-extension MIME, 11 MB reject,
wrong-app/wrong-doc scope (new), Firestore-failure cleanup + lease release
+ same-token retry (new), filesystem-failure/metadata-untouched + retry
(new), orphan-file cleanup on re-upload (new).

## 10. Concurrency tests

Preserved from Phase 1 and green: same-capability race → exactly [201,403]
with intact winner metadata; concurrent different-document uploads → both
ready with distinct refs; 10× same-nonce applications → 1 record.

## 11. Changes made

`backend/src/services/documents.ts`: (a) disk-write failures now release
the lease + remove partial bytes (previously an unhandled throw could wedge
the token until TTL); (b) metadata PATCH asserts the entry exists; (c)
re-uploads unlink the replaced file (strict shape check) after commit.
`backend/tests/fakes.ts`: `failNextUpdate` fault injection.
`backend/tests/documents.test.ts`: +4 tests above. Nothing else touched.

## 12. Files created/modified/deleted

Created: this audit doc. Modified: `backend/src/services/documents.ts`,
`backend/tests/{fakes,documents}.test.ts`. Deleted: none.

## 13. Final verification

- Backend: typecheck PASS · tests **54/54** · build PASS (`dist/server.js`).
- Frontend: typecheck PASS · tests **277/277 (28 files)** · build PASS.
- Phase 1 guarantees re-verified intact (lease/TXN/hash/TTL/scope/consume,
  deny-all storage rules, no Static serving, no recovery endpoint).

## 14. Remaining document-related technical debt

- Unused-but-valid capabilities accumulate until TTL (no sweeper; harmless).
- Overwritten-file cleanup is best-effort (post-commit unlink).
- `previousOrderIds`-style history has no document analogue needed.
- Live end-to-end pass with real Firebase + disk (not emulator/tmpfs)
  still advisable before launch traffic.
