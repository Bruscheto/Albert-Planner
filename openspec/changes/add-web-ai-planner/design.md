# Implementation design

Status: revised 2026-09-22 after inspecting the local MVP. Sections 1–12 describe the hosted product target except where labeled current. The next executable milestone is [Local AI MVP](ai-mvp.md); it takes precedence for the next increment. Estimates below are the original baseline, not remaining effort.

## 1. Product and first-release boundary

Build a personal NYU semester planner. A student signs in, imports a shortlist, describes goals, compares up to three feasible plans, changes a preference, and saves the chosen plan. AI is required for the first release, with a manual planner available during outages.

Start with one term and NYU CS/math course evidence. Imported courses outside curated coverage still work for scheduling; their educational-fit evidence is explicitly unknown. Accounts are ordinary product accounts, not NYU SSO. Use email link login initially; add Google only if onboarding evidence warrants another provider. No institutional integration is assumed.

Release 1 includes landing page, login, profile, import preview, course list, weekly calendar, AI recommendation cards, comparison, save/duplicate, and settings/export/delete. Completed courses may be entered manually as context, not as verified transcript records.

Later: direct extension transfer, broader evidence coverage, and multi-term exploration. Exclude registration automation, certified degree audits, transcript ingestion, payments, social features, and an unconstrained agent browsing the internet.

Success is a complete decision loop, not a login site with a chatbot attached: a student can explain why a recommended plan fits, inspect its uncertainty, and retain their chosen result.

## 2. Current-code evidence and reuse

| Current module | Observation | Implementation treatment |
| --- | --- | --- |
| `src/content/albert-intake.js` | Albert DOM intake already exists | Keep extension-only; consume its normalized output |
| `src/storage/course-storage.js` | Chrome-local CRUD, validation, export and import | Keep local persistence; extract pure validation only when both apps need it |
| `src/planner/session.js` | Loads Chrome storage and listens for key changes | Do not use as the web session layer |
| `src/planner/planner.js` | Greedy priority scheduler, flattening, and storage-bound analysis coexist | Extract pure functions into shared core; preserve existing imports through re-exports |
| `src/shared/calendar-utils.js`, `time-parser.js` | Reusable time and overlap calculations | Move with dependencies into shared core and preserve behavioral tests |
| `src/weekly-view/schedule-model.js` | Derived schedule state plus color presentation | Reuse calculations; keep visual color treatment outside server planning |
| `src/rmp/rmp-service.js` | Existing professor lookup | Keep local for first release; do not upload rating caches as planning evidence |

Important limitations: `generateOptimalSchedule` is greedy, not a global optimizer. TBA meetings can pass its conflict handling; missing time must become an explicit unknown in the new planner. Weekly contact hours are not homework/workload estimates. Existing exported data includes all Chrome storage; never send that entire object to the model or copy every key into cloud storage. Existing `importData` clears local storage and omits active-term restoration; do not use it as a cloud-sync implementation.

Current working tree contains unrelated implementation changes. Implement each phase against the then-current checkout and preserve those edits.

### Implemented local prototype (verified 2026-09-22)

`apps/web/` is static HTML/CSS/JavaScript with locally hosted Inter, not a Next.js application. It imports existing pure calendar helpers directly. Implemented: validated local JSON import, sample data, weekly agenda, immutable named localStorage snapshots, two-plan comparison, and a greedy suggestion with maximum credits / earliest start time. Suggestions preview exclusions and require explicit application; editing inputs invalidates them.

Four runnable Node checks pass: `import.test.js`, `saved-plans.test.js`, `compare.test.js`, and `suggest.test.js`. These are focused checks, not full browser coverage or evidence of hosted readiness. The extension test/build passed earlier in this task; they were not rerun in this documentation review.

Missing: accounts, API/server, AI calls, goal profiles, course-content evidence, term-safe identity, minimum credits, locked/excluded courses, unavailable days, automatic sync, and production deployment. Local snapshot persistence is not account persistence. The agenda is not a time-proportional calendar. `parseBackup` drops term/institution and component provenance; saved v1 records cannot recover those fields without reimport or user confirmation. `comparePlans` compares full JSON course records, so it is a snapshot difference view, not a semantic academic comparison.

## 3. Architecture and repository layout

Hosted-product target (not a prerequisite for the local AI milestone): Next.js with TypeScript for the web UI and API routes; Supabase Auth and Postgres for accounts and persistence; OpenAI structured output for goal interpretation and bounded explanations. Use standard CSS initially. Choose supported package versions at implementation time and lock them. One web deployment and one database are enough; no separate Python service, agent framework, vector database, or queue in release 1.

```text
entrypoints/                existing WXT entrypoints stay here
src/                        existing extension code stays here
apps/web/                   Next.js app, routes, components, server-only AI code
packages/planner-core/      pure TypeScript contracts and scheduling functions
supabase/migrations/        schema, indexes, RLS, transactional write functions
supabase/seed.sql           non-personal development examples
test/                       existing extension checks
```

When implementing the hosted app, add `pnpm-workspace.yaml` for `apps/*` and `packages/*`; keep the root extension package and its existing build commands. Add explicit web commands rather than changing `pnpm build` semantics. Both applications depend on shared core. Do not move all extension files or convert all JavaScript as part of this expansion.

Data flow: extension export → browser import preview → authenticated web API → private course snapshot → deterministic candidate generation → model explanation → validated recommendation → explicit save.

The server owns AI calls, authorization, limits, and writes. Model credentials and privileged database keys never reach either browser bundle. User requests use user-scoped database access and RLS. Privileged operations are isolated to account administration.

Reference basis: [Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [server-side auth](https://supabase.com/docs/guides/auth/server-side), [database security](https://supabase.com/docs/guides/database/secure-data), [Next.js authorization guidance](https://nextjs.org/docs/app/guides/authentication), and [structured output](https://openai.com/index/introducing-structured-outputs-in-the-api/). These support the integration choices, not claims that generated advice is correct.

## 4. Screens and interaction

| Route | Behavior |
| --- | --- |
| `/` | One product explanation, sign-in and local sample preview |
| `/login`, `/auth/callback` | Email-link login, expired-link retry, fixed allowlisted return paths |
| `/onboarding` | Term, interests/goals, credit range, unavailable times; optional completed courses |
| `/plans` | Saved plans, create, duplicate, delete, last updated |
| `/plans/[id]` | Course shortlist, calendar, goals, generate/compare, evidence drawer, save status |
| `/settings` | Profile, AI data-use explanation, export and delete account |

On desktop, place the calendar next to recommendations; on mobile use accessible Courses / Calendar / Suggestions tabs. Use chat-like text input for requests but display structured plan cards as the result. Every card offers concrete course changes, rationale, known conflicts, unknowns, and source details. Applying a suggestion updates a draft; saving remains an explicit action. Retain the original plan for comparison.

Treat locked courses and unavailable times as hard constraints, and interests, compact days, and learning style as preferences. Display interpreted constraints for confirmation before generation. Do not silently infer hard exclusions from ambiguous prose.

Empty and failure states: no courses → import/manual entry; insufficient evidence → limited recommendation; conflicting locked courses → explain the conflict; TBA → provisional plan; model failure → retain calendar and show deterministic candidates without AI explanation; expired session → reauthenticate without claiming unsaved work was stored.

## 5. Data contracts and database

Use UUID primary keys and UTC timestamps. Preserve local source IDs separately from cloud IDs. Ownership comes from the verified session, never an accepted request `userId`.

| Table | Minimum fields and rules |
| --- | --- |
| `profiles` | `user_id` FK to auth, display name, profile JSON, profile revision; one per user |
| `course_sets` | id, user_id, institution, term key/label, schema_version, validated courses JSON, buckets JSON, selection JSON, source, imported_at, content_hash; immutable snapshots |
| `plans` | id, user_id, name, course_set_id, selected course IDs, constraints JSON, revision, timestamps; selections reference the associated snapshot |
| `planning_runs` | id, user_id, plan_id, input plan/profile revisions, input hash, status, validated result JSON, model/prompt/evidence versions, usage, timestamps |
| `course_evidence` | id, canonical course key, version, reviewed_at, structured claims JSON; authenticated read, curated writes only |

Keep small snapshot and result payloads in JSONB; use relational columns for ownership, lifecycle and indexes. Validate JSON on the server with one shared runtime schema (Zod is a justified new dependency here). Add indexes on owner and plan lookup columns and an owner/content-hash uniqueness rule for import retry handling. Enforce same-owner references with composite foreign keys or equivalent transactional checks, not just application convention. Courses are private snapshots, not authoritative global catalog records.

Course contract: source ID, institution, term key, course code, section, title, credits, instructors, components, source timestamp. Components retain type, section identity, meeting days, time range or null, room, TBA and manual-override provenance. Use institution/term/course/section to derive scoped identities; missing or ambiguous term requires user confirmation. Reject duplicate IDs, invalid ranges, negative credits, unknown selected IDs, oversized fields, and malformed components before writes. Preserve original imports when normalization loses information; report warnings.

Goals contract: primary goal text, interest tags, optional completed course codes, preferred learning formats, workload preference, credit minimum/maximum, locked/excluded IDs, unavailable intervals and campus time zone. Store explicit versus model-proposed fields distinctly. NYU New York uses America/New_York; do not infer compatibility across campuses or term sessions. Until date-range support exists, mixed/ambiguous sessions are provisional.

Plan updates use optimistic concurrency: `UPDATE ... WHERE revision = expected_revision` and increment in the same transaction. Zero rows means 409 and reload/duplicate choices. Never overwrite a newer plan with an older tab. Imports create snapshots; refreshing a shortlist produces a new snapshot with a reviewed diff, not mutations that silently change saved plans.

## 6. Authentication, privacy and persistence

Use Supabase's supported server-side auth integration and verify the user at every API boundary. Route visibility alone is not authorization. Enable RLS on every private table with both read/write ownership policies. Test using two real test users and anonymous requests. Disable shared caching of personalized responses; enforce same-origin mutation requests and the auth integration's CSRF protections. Validate redirect destinations.

First-login upsert creates the profile without overwriting existing preferences. Logout clears application state. Email link handling must survive expired/reused links and session refresh. Login does not itself authorize uploading local extension data.

Before first upload, show the allowed data fields and destination; before first AI use, explain which goal/course fields are sent to the provider. Do not send email, auth tokens, raw Albert HTML, full local storage, or transcript files. Treat user input and course descriptions as untrusted content, never instructions granting tool access.

Replace the existing local-only privacy claims before cloud features are released. Record consent version/time. Proposed retention: saved plans until deletion, planning-run content 30 days, operational logs 14 days; configure and verify these rather than promising unsupported provider retention. Verify actual provider data handling before launch and disclose it accurately.

Export returns all user-owned planning data in a versioned JSON document. Account deletion revokes access, removes owned data and auth identity through a retryable workflow, and prevents pending runs recreating data. Explain backup expiry separately from immediate live deletion. No personal prompts in application logs.

## 7. Import now, connected transfer later

Release 1: reuse the existing Download JSON action. Website reads the file locally, accepts the known v1 envelope, extracts only allowlisted fields, validates, previews term/course counts and warnings, and uploads after confirmation. Reject unsupported versions; import must never invoke Chrome `clear()` or overwrite a saved cloud plan. Start with a 2 MB / 100-course limit and explain excess-size errors. Hash the normalized payload so repeated submits return the same snapshot. Sample data currently lets the site work without the extension; manual entry remains unimplemented.

Follow-up: explicit “Import from extension” on the website. Add Chrome external messaging only for the exact production origin, validating sender URL and message shape. Website requests a snapshot; extension UI asks the student to approve the transfer; response is the same allowlisted payload. The website performs the existing preview/upload flow with its own session. No website auth token is passed to content scripts, and no broad origin wildcard is allowed. Validate the Chrome API contract before implementing this phase.

No continuous sync in release 1. Website owns saved cloud plans; extension owns its local cart. Later bidirectional sync requires mapped identities, base revisions, deletion semantics, offline retries and a visible conflict UI; design it when users actually need editing from both surfaces.

## 8. Hosted AI planning pipeline

For the next local implementation, use [ai-mvp.md](ai-mvp.md). This section remains the larger hosted target; authenticated access and database-backed run history are not present today.

1. Verify session, validate input size and reserve per-user daily usage atomically. Starting beta cap: 10 generation requests per user/day and one active request/user. Caps are operational configuration.
2. Load the user's immutable course snapshot and exact plan/profile revisions. Never accept arbitrary course payloads as authorized database records.
3. If prose changes goals, request a structured goal patch. Show ambiguities and ask for confirmation rather than inventing constraints.
4. Retrieve course evidence by normalized course code/institution, with term-sensitive facts separately scoped. Begin with 20–30 curated CS/math records and reviewed source links. Unknown evidence stays unknown; imported meeting data does not prove availability or prerequisites.
5. Generate candidate combinations deterministically: include locked courses, eliminate explicit exclusions, respect credit bounds, group alternate sections, and check all required components for overlap and unavailable times. Treat selected linked components as indivisible until section linkage rules are represented.
6. Start with bounded depth-first search and early pruning for at most 30 eligible course options, 10,000 visited nodes, and a small retained candidate set. Above the cap ask for a narrower shortlist. Return up to three distinct nondominated candidates across stated goals, campus days and contact hours. A search cap means “search incomplete,” never “no possible plan.” Existing greedy generation is a baseline, not proof of optimality.
7. Separate feasible-on-known-data candidates from provisional TBA/prerequisite/session cases. Unknowns cannot satisfy a verified hard condition. If all candidates are provisional, show that status explicitly.
8. Send only the confirmed goals, candidate IDs, calculated differences and evidence claims to the model. Request short rationales, tradeoffs and evidence references in a strict schema. The model cannot add courses or execute actions.
9. Validate output schema and membership of every course, candidate and evidence ID. Prefer explanations composed around supplied claim IDs; reject unsupported factual statements in evaluation and show authoritative structured facts beside prose. Schema validity alone does not establish factual correctness.
10. Persist the validated result against input revisions. A user accepts a candidate with an expected plan revision; if the profile or plan changed, mark it stale and regenerate or review before applying.

Example result contract: `runId`, `inputRevision`, `status`, `candidates[{id, courseIds, credits, contactHours, hardChecks, unknowns, rationale, evidenceIds}]`, `searchComplete`, `warnings`. Academic requirement status is always unverified in release 1.

Use one provider SDK and a server-only module with a configurable model name. Select the model by evaluation results; do not precommit to pricing or a specific model. Bound output tokens and requests. Use a request timeout compatible with the hosting runtime, initially target 25 seconds; store a failed/timed-out state and offer retry without losing plans. Repeated idempotency keys return the same run; retries may not silently multiply usage. Add a queue only if measured request duration requires it.

Evidence curation must distinguish syllabus facts, user-entered assumptions, contact hours, and inferred workload. No GPA optimization or unsupported promises about jobs or learning outcomes. No live RMP scraping in this server pipeline.

## 9. API outline

| Endpoint | Contract |
| --- | --- |
| `GET/PATCH /api/profile` | Read/update current user's validated profile with expected revision |
| `POST /api/imports` | Normalized snapshot, schema version, idempotency key → snapshot ID and warnings |
| `GET/POST /api/plans` | List own plans / create against owned snapshot |
| `GET/PATCH/DELETE /api/plans/:id` | Ownership enforced; PATCH requires expected revision |
| `POST /api/planning-runs` | Owned plan ID, revision, confirmed goal revision, idempotency key → validated result/status |
| `POST /api/plans/:id/apply` | Owned run/candidate IDs plus expected revision → updated plan |
| `GET /api/account/export` | Download user's versioned data |
| `DELETE /api/account` | Recent authentication and explicit UI confirmation → deletion workflow |

Use 400 for malformed input, 401 for missing login, 404 for absent/inaccessible resources, 409 for stale revisions, 413 for payload limits, 429 for quotas, and 503 for unavailable AI. Return field-level validation issues, not database internals. Validate run ownership and candidate membership on apply; never trust a client-edited result.

## 10. Delivery sequence and effort

Assumption: one developer, roughly 20–30 focused engineering days for a private beta, plus external account/email provisioning and student feedback time. Reduce scope before adding infrastructure if time is shorter.

| Phase | Effort | Concrete delivery / exit criterion |
| --- | --- | --- |
| 0: Contracts and baseline | 1–2 days | Existing checks recorded; sample export and boundary cases; scoped course/goal schemas; acceptance dataset |
| 1: AI vertical slice | 4–6 days | Local sample → goals → deterministic candidates → real server model explanation → comparison; no credentials in browser; unsupported output rejected |
| 2: Accounts and saved plans | 4–6 days | Web scaffold from phase 1 gains email login, migrations/RLS, profile, revisioned save/duplicate/delete; two-user isolation checks pass |
| 3: Real course import | 3–4 days | Legacy export preview/normalization, explicit upload, immutable snapshots, unknown time handling; real redacted export works |
| 4: Integrated planning UX | 4–6 days | Calendar, lock/exclude, confirmed goal changes, evidence drawer, apply/undo via retained draft, responsive keyboard flow |
| 5: Private-beta release | 4–6 days | Quotas/timeouts, export/delete/retention, privacy update, deployment isolation, migration/restore check and student acceptance |
| 6: Direct extension transfer | 2–3 days after beta | Origin-scoped consented transfer reuses import flow; extension still works offline and logged out |

Phase 1 intentionally proves the core AI value before account work dominates the project. It is a local developer slice, not an anonymously exposed AI endpoint. Phases 2–5 complete the first release. Evidence curation occurs alongside phases 1 and 3 within their estimates; larger catalog coverage changes the estimate.

## 11. Verification and release gates

Preserve existing `pnpm test` and `pnpm build` (use `corepack pnpm` if needed). Add web typecheck/build and focused core tests. Test logic that can break decisions: adjacent versus overlapping intervals; TBA; weekends; multi-component courses; mutually exclusive sections; credit bounds; conflicting locked courses; no valid candidate; truncated search; invalid/duplicate imports; legacy terms; stale revisions.

Database integration checks: anonymous denied, user A cannot read/write/reference user B's snapshots/plans/runs, duplicate import safe, concurrent save conflicts, deletion removes owned rows. AI checks: malformed output, invented IDs, fake evidence, prompt injection in descriptions, refusal, timeout, retry, quota race, and stale apply.

Maintain at least 12 fixed planning scenarios spanning those cases, with expected hard checks and human-reviewed evidence. Release requires zero accepted known hard-constraint violations and zero accepted invented course/evidence IDs in that set. Evaluate live model explanations separately for unsupported claims and relevance; do not treat a small test set as a general correctness guarantee.

Browser acceptance: sign in → import → edit goals → generate → inspect evidence → apply → save → reload; second-tab conflict; sign out; delete account. Check keyboard and mobile layouts. Try with 3–5 students using their own chosen shortlists; record whether they understand one tradeoff and one uncertainty.

Measure generation success rate, latency, tokens/request, and save failures without prompt contents. Proposed beta target: typical generation under 20 seconds, with visible timeout/retry behavior. Set a provider spending limit/alert and a server kill switch. Model disablement leaves saved/manual plans working.

Use separate development/preview/production databases and credentials. Run migrations before dependent deploys; favor additive migrations during beta. Verify backup/restore for the selected service tier before storing beta data. Web deploy, extension packaging/store release, and DNS are separate gates. Provisioning and publication require a later explicit request.

## 12. Open choices with working defaults

- Brand: Albert Planner; FutureFork remains historical concept material.
- First audience: NYU CS/math students planning one semester.
- Login: email link; no NYU institutional dependency.
- AI scope: suggest combinations from imported/curated records, not discover arbitrary live offerings.
- Initial transfer: reviewed JSON import; direct bridge after beta.
- Hosting: Next.js-compatible managed hosting plus Supabase; select account/project and spending ceiling before provisioning.
- Academic validity: known schedule checks only; degree and prerequisite verification remain visibly unresolved.

These defaults permit implementation planning without blocking on branding, provider account setup, or a full university catalog. Change them explicitly if the intended first audience or multi-term scope differs.
