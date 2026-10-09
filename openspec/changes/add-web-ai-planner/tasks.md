# Implementation tasks

Reviewed 2026-09-22. The original hosted-product tasks below remain unchecked because their full acceptance criteria are not met. Partial local work is recorded separately rather than marking cloud/auth tasks complete. Implement [ai-mvp.md](ai-mvp.md) next.

## Local prototype completed
- [x] Add static web entrypoint, Inter styling and sample course flow.
- [x] Parse and preview allowlisted v1 exports locally without uploading them.
- [x] Render course selection, weekly agenda, credits, overlaps and unknown-time warnings.
- [x] Save immutable named snapshots in localStorage and reopen after reload.
- [x] Compare two saved snapshots and known contact-hour totals.
- [x] Suggest a selection using maximum credits and earliest start; preview exclusions before applying.
- [x] Add focused import, storage, comparison and suggestion checks; all four pass in this review.

## Next: local AI milestone
- [x] A1 Preserve term and institution context; migrate old snapshots non-destructively and require confirmation of unknown context.
- [x] A2 Add confirmed constraint schema: maximum credits, earliest time, unavailable days, locked/excluded course IDs.
- [x] A3 Extend the pure scheduler and checks for those constraints; distinguish preference from locked inclusion.
- [x] A4 Add loopback-only server with allowlisted static routes, request validation, origin/Host protection, limits and server-only model credentials.
- [x] A5 Implement goal interpretation with a strict allowlisted patch and visible unsupported-goal/ambiguity results.
- [x] A6 Add review/edit/confirm UI, input revisions, stale-response rejection, and explicit suggestion application.
- [x] A7 Implement grounded explanation selection from server-generated facts; show unknown educational fit explicitly.
- [ ] A8 Validate live provider output and failure paths, plus the fixed acceptance cases in ai-mvp.md.
- [ ] A9 Document provider setup/data use and record a real end-to-end call separately from mocked tests.

Implementation note (2026-09-22): A1–A7 are implemented in the local product slice. A2/A3 are available as manual rules in the existing schedule suggestion UI. New snapshots retain constraints; legacy snapshots receive defaults in memory without rewriting storage. A4/A5 use the loopback server and optional OpenAI Responses adapter; A6 handles review, revisions and explicit application; A7 grounds explanations in server-generated facts. Focused web/server tests and the synthetic acceptance harness pass. A8/A9 remain open because the current environment has no provider credentials, so live semantic quality and a real end-to-end provider call are unverified.

## Hosted-product backlog

## 1. Baseline and shared contracts
- [ ] 1.1 Record current extension test/build results and preserve unrelated changes.
- [ ] 1.2 Add pnpm workspace and web/core package boundaries without moving extension entrypoints.
- [ ] 1.3 Define runtime course, snapshot, goals and result schemas with redacted export fixtures.
- [ ] 1.4 Extract pure schedule helpers; preserve callers and existing tests through re-exports.
- [ ] 1.5 Add hard-constraint and unknown-data scenario checks.

## 2. AI vertical slice
- [ ] 2.1 Scaffold local web planner with sample courses and confirmed goals.
- [ ] 2.2 Curate initial evidence records and source-review dates.
- [ ] 2.3 Implement bounded candidate generation and explicit incomplete/provisional statuses.
- [ ] 2.4 Implement server-only structured model calls, output validation and deterministic failure fallback.
- [ ] 2.5 Render candidate differences and evidence; evaluate 12 fixed scenarios.

## 3. Accounts and persistence
- [ ] 3.1 Add auth integration, login callback, profile onboarding and logout.
- [ ] 3.2 Write migrations, ownership constraints, RLS policies and two-user integration checks.
- [ ] 3.3 Implement immutable snapshots, revisioned plan CRUD and stale-write responses.
- [ ] 3.4 Implement authenticated run creation/apply with ownership and stale-result checks.

## 4. Course import and complete UX
- [ ] 4.1 Add local v1 export parsing, allowlist, validation, preview and explicit upload consent.
- [ ] 4.2 Add idempotent imports, term confirmation and snapshot refresh diffs.
- [ ] 4.3 Build weekly calendar, lock/exclude controls, comparison and explicit draft application.
- [ ] 4.4 Complete mobile/keyboard, empty, unknown, expired-session and model-failure states.

## 5. Private beta
- [ ] 5.1 Add atomic quotas, request idempotency, timeouts and server AI kill switch.
- [ ] 5.2 Implement user export, retryable deletion, retention and consent records.
- [ ] 5.3 Update privacy disclosures to match verified cloud/provider behavior.
- [ ] 5.4 Run extension checks, web typecheck/build, core/DB/AI and browser acceptance checks.
- [ ] 5.5 Conduct 3–5 student trials and resolve critical trust/usability problems.
- [ ] 5.6 Select deployment accounts/budget, then provision only when requested; validate migration/restore and release separately.

## 6. Post-beta transfer
- [ ] 6.1 Verify Chrome external-messaging APIs and define exact origin allowlist.
- [ ] 6.2 Add explicit extension approval and allowlisted snapshot transfer.
- [ ] 6.3 Reuse website preview/import; test denied origins, cancelled transfer and local-only operation.

Context increment (2026-09-22): import preserves allowlisted term, institution,
campus and time-zone fields, including the extension's structured term. Mixed
known contexts are rejected. Unknown context requires acknowledgement before
manual suggestions; acknowledgement does not verify meetings. Legacy snapshots
remain untouched and require review when opened. Five web suites pass. Detailed
meeting date ranges and source evidence are not present in this prototype and
must not be claimed as verified by the later AI endpoints.

AI interpretation increment (2026-09-22): A4/A5 implemented with native Node HTTP
and OpenAI Responses fetch, strict request/output validation, no-store static
assets, loopback Host/Origin checks, request size/count/concurrency/time limits,
and cancellation. A6 interpretation review/edit/confirm and stale-response handling
are implemented; the separate server candidate/result flow remains with A7.
Mock-backed HTTP/provider/revision tests pass; browser synthetic flow verified
consent, review without mutation, invalidation, confirmation, manual preview,
application, save, reload and reopen. Unresolved goal notices remain visible after rule confirmation. API credentials/model are absent, so live semantic quality
and the full live acceptance gate remain unverified. Setup and privacy documents
are updated; A8/A9 remain open until live verification is recorded.

Server candidate increment (2026-09-22): `/api/ai/suggest` recomputes schedules and
facts from validated snapshots and constraints. Model-selected fact IDs are
strictly validated; missing configuration, busy/quota, malformed output and timeout
fall back to deterministic facts. Both routes share quotas and concurrency. Browser
results require separate consent, expire, invalidate on input changes and recheck
selection before apply. A unified client revision counter covers both goal and
draft changes and is echoed in both revision fields for this local slice.
Twelve AI/server tests plus five planner suites pass. Browser verified consent and
the real local endpoint's disabled-provider fallback. Live provider quality and
full live acceptance remain outstanding, so A8/A9 remain open.

Acceptance tooling increment (2026-09-22): added a synthetic live runner with an
explicit --live gate, four-call limit, no automatic retries, private isolated
server and sanitized case-level reporting. It fails on semantic constraint
mismatches and refuses to treat explanation fallback as successful live evidence.
Added cross-endpoint concurrency/budget and chunked oversized-body checks.
`npm run test:web` now runs the complete offline web/server suite. Live execution
is still outstanding: neither environment credentials nor server/.env are present.
A8/A9 intentionally remain open. Browser responsive/keyboard review is also still
required before declaring the full local milestone complete.
