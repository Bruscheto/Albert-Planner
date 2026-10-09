# Next milestone: local AI-assisted planning

Reviewed 2026-09-22. This narrows the hosted design for the next increment; no AI functionality is implemented by this document.

## Outcome and boundaries

Student enters “No Friday classes, nothing before 10, at most 16 credits.” The model proposes editable constraints. After confirmation, application code produces a schedule and explains its choices using calculated facts. The student applies and saves a copy.

This is a local development MVP, not a public unauthenticated AI service. Keep the current static UI and local saves. Add one Node server to serve the web app and AI endpoints on loopback. Do not introduce Next.js, Supabase, a monorepo migration, agents, embeddings or a queue for this milestone. The hosted architecture remains a later decision.

A request such as “prepare for ML” is captured as an aspiration, but cannot rank courses on educational fit from titles alone. Show “Course-content evidence is not available for this goal.” Do not claim this slice implements academic or career recommendation. The follow-up milestone adds reviewed course descriptions/syllabi and evaluates goal-based ranking before expanding coverage.

## Prerequisites found during review

1. Preserve institution, term and meeting-context provenance at import. Reject mixed terms for this one-term workflow; unknown term/campus requires confirmation. Existing v1 saved snapshots have lost this context: preserve their records and prompt for confirmation/reimport rather than silently assigning a term. Course IDs remain scoped to a snapshot.
2. Extend `suggestSchedule` for unavailable days and locked/excluded IDs. Current checked courses merely sort first; they are not guaranteed inclusion. The UI must make that distinction explicit.
3. Keep current rules for missing meetings: exclude from automatic suggestions and explain why. Meeting/date/time-zone uncertainty must never become a verified schedule claim. Contact hours do not estimate homework.

## Smallest implementation boundary

Keep browser code in `apps/web/`. Put server entrypoint, provider integration and environment configuration outside the static asset directory, e.g. `server/`. Reuse pure import/scheduling modules through explicit imports. New runtime schemas should be shared where practical; avoid maintaining different client/server constraint definitions.

Server serves only approved web assets and the exact shared modules they require. Never expose the repository root, `.env`, Git metadata or server source as static files. Bind to `127.0.0.1`; reject unexpected Host and mutation Origin headers, require JSON and same-origin requests, and do not enable permissive CORS. Loopback binding alone does not protect against hostile websites invoking local services.

Read API key and model from environment. No browser key entry, key storage, or raw provider error responses. Use one official provider SDK or native fetch, selected at implementation; verify current API syntax then. Missing configuration produces a clear disabled state while the manual planner remains usable.

Starting operational limits: 2,000-character goal, 100 courses (the import limit), 256 KiB request body, 25-second timeout, one active generation per local server and 20 model requests per process session. These are prototype limits, not production abuse prevention. No automatic paid retries. Explicit retry creates a new attempt after the previous attempt finishes/cancels. Abort provider work on client disconnect where supported.

## Contracts and sequence

### 1. Interpret

`POST /api/ai/interpret`

Input: `{requestId, draftRevision, goalText, currentConstraints, courses:[{id, courseCode, title, section}]}` plus confirmed planning context. Client sends only fields shown in the data-use notice, not full backups, names/emails, RMP caches or raw HTML.

Output: `{requestId, draftRevision, proposedConstraints, unresolvedGoals, clarificationQuestions}`.

Constraint fields: `maxCredits` (0 < value <= 30), `earliestMinutes` (0–1439), `unavailableDays` (fixed weekday enum), `lockedCourseIds`, `excludedCourseIds`. Omitted fields retain current values; explicit clear operations must be visible. Validate IDs against the request snapshot and reject intersections of locked/excluded IDs. If “keep math” maps to several courses, ask which rather than choosing silently.

Show all changes in a small form. Nothing affects the active draft until confirmed. Unclear or unsupported preferences remain visible. The model may not invent course IDs or translate aspirations into fabricated course facts.

### 2. Confirm and generate

`POST /api/ai/suggest`

Input: `{requestId, draftRevision, goalRevision, confirmedConstraints, courseSnapshot, planningContext}`.

Revalidate everything on the server, even when the client already validated it. Run the shared scheduler server-side; do not accept client-computed candidate facts as authoritative. Include locked courses first and fail visibly on mutually conflicting locks or locks incompatible with credit/day/time constraints. Never quietly drop a lock. Filter exclusions, unknown meetings, alternate sections and hard constraints, then use the current greedy order for remaining courses.

Return one candidate for this milestone, labeled “Suggested combination,” not “best” or “optimal.” No minimum-credit promise. An empty greedy result does not establish that no feasible combination exists. Multiple candidates/bounded search remain later work.

### 3. Explain grounded facts

Compute a fact table on the server: selected IDs, total credits, known contact hours, meeting days, earliest start, reasons for each exclusion and unresolved conditions. Give each fact a stable ID within the result.

For this first explanation slice, the model selects/orders allowed fact IDs and fixed explanation categories in a strict response schema. The UI renders factual sentences from those validated facts; do not accept arbitrary academic assertions as authoritative prose. Schema-valid free text can still hallucinate, so schema checking alone is not a factuality safeguard.

No tool execution or live browsing. Course text and user prose are untrusted data. Reject extra/unknown IDs, unsupported categories and malformed output. On model refusal, timeout or invalid explanation, return the deterministic candidate with plain rule-based reasons and a visible “AI explanation unavailable” state. Interpretation failure leaves constraints editable manually.

### 4. Review, apply and save

Result: `{requestId, draftRevision, goalRevision, candidate:{courseIds, facts, skipped, unknowns}, explanationFactIds, explanationStatus}`.

Increment draft revision on any import, open, clear, course-selection or constraint change. Goal edits increment goal revision. Late responses whose revisions/request IDs differ are discarded; applying always rechecks freshness and known constraints against current state. Cancel superseded requests. No model response auto-applies or auto-saves.

Extend saved snapshot format additively with confirmed constraints and planning context. Continue reading v1 records; preserve their original storage keys and never rewrite them on load. Do not store raw goal prose or provider payloads by default. Provide an explicit choice if retaining goal text becomes useful.

## Privacy and errors

Before the first model request, show the selected provider and exact categories of data sent; request the student's explicit action to continue. Existing manual imports and snapshots remain local. Avoid claiming all web data stays local once AI is enabled. Update web copy and scope the repository privacy policy to distinguish the extension from optional web AI. Do not promise provider retention settings until verified for the configured account/API.

No request bodies, goals or course snapshots in logs; log status, duration and token counts only. In-memory requests/results expire within 10 minutes and are bounded in number. Server restart clears them. Serve UI errors for invalid input, missing configuration, busy/limited service, timeout and invalid provider output; never expose credentials or stack traces.

## Acceptance cases

Use runnable checks with mocked provider responses for repeatability, plus a separately recorded live-provider smoke test using synthetic courses:

1. Credit/time/day preferences normalize correctly and require confirmation.
2. Ambiguous “keep math” asks for clarification.
3. “Prepare for ML” remains unresolved without content evidence.
4. Unknown course IDs and extra output fields are rejected.
5. Locked-course conflicts cannot silently drop a course.
6. TBA meetings are excluded with a reason.
7. Duplicate sections cannot both be selected.
8. A candidate respects confirmed credit/day/time constraints.
9. Model refusal/malformed explanation keeps manual planning available.
10. A late response after changing goals/imports cannot apply.
11. Unapproved Origin/Host, oversized body and exhausted budget never reach the provider.
12. Saving/reopening preserves confirmed constraints; old v1 snapshots still load without destructive migration.

Browser gate: sample import → enter goal → review interpreted fields → confirm → inspect suggestion/exclusions → apply → save → reload → reopen. Also verify no selection changes before apply and no network call before AI consent. Use actual Inter layout at narrow width and keyboard-only input.

Done means a real model call has completed this path with synthetic data, not just a mocked response or disabled endpoint. If credentials are unavailable, explicitly report implementation verified with mocks and live verification outstanding. Provisioning/publication remains out of scope.

## Follow-up after this milestone

Curate a small, named course-evidence set with source/date provenance; use it to evaluate actual goal fit and tradeoffs. Only then broaden to multi-candidate goal ranking. Accounts/cloud persistence follow the original plan. Re-estimate remaining hosted work after the local slice; the old 20–30-day estimate is not a current commitment.
