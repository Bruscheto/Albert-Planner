# Albert Planner product update goal

## Goal

Turn Albert Planner from an extension with a local web prototype into a nearly launchable planning product: a student can import an Albert course export, understand the planning context, describe a scheduling goal, review editable rules, generate a grounded schedule suggestion, compare alternatives, save a plan, and return to it later. The experience should feel like a focused planning product with a coherent visual identity, while the backend should have clear boundaries for authenticated persistence and provider-backed AI when those services are provisioned.

The product must remain trustworthy when information is missing. Unknown meeting times, unverified academic fit, ambiguous goals, unavailable AI, and stale results are visible states. The system never silently invents facts, drops a required course, applies a model response, or claims that a schedule is optimal.

## Product and design direction

Design the web workspace as a calm, editorial planning tool rather than an AI chat screen. The primary path is a single visible workspace:

1. **Import** — choose an exported course file or load sample data; preview term, institution, campus, time zone, course count, and unknown fields before confirmation.
2. **Shape the goal** — enter a plain-language goal and show the exact data-use notice before any optional provider request.
3. **Review rules** — display interpreted constraints as editable controls: maximum credits, earliest start, unavailable days, required courses, excluded courses, and unresolved questions.
4. **Preview the plan** — show the suggested combination, credits, meeting pattern, known contact hours, exclusions with reasons, unknowns, and any conflict warning.
5. **Compare and keep** — let the student compare saved drafts, explicitly apply a suggestion, name the plan, save it locally now, and preserve the same contract for future account-backed storage.

Use strong hierarchy, generous whitespace, clear status labels, and compact cards that make uncertainty legible. Keep the current Inter typography unless a design pass demonstrates a better accessible choice. The interface must work at narrow mobile widths, support keyboard navigation and visible focus, and avoid decorative motion that competes with planning decisions.

Use image generation only as a design entry point: create a small visual direction board or hero/background concept for tone, color, texture, and composition. Generated imagery must stay outside the decision surface, have a local fallback, and never become a required runtime asset. Define boundaries before implementation: no stock-photo dashboard, no fake course content, no visual treatment that implies verified academic recommendations, and no image that reduces contrast or obscures controls.

## Frontend structure

Keep the current static application in `apps/web/`. Refine it into explicit product surfaces rather than adding a framework prematurely:

- import and context review
- goal and consent panel
- editable constraint review
- deterministic suggestion and grounded explanation result
- saved-plan list, plan comparison, and reopen flow
- reusable status, empty, error, unknown-data, and loading states

Keep scheduling, import validation, snapshot migration, revisions, and comparison as pure modules with focused tests. Keep draft state separate from saved state. Every asynchronous result carries request and revision identifiers; stale results are discarded. The UI never changes the active draft until the student confirms or applies an action.

## Backend structure

Keep `server/` as a small boundary layer that can later move behind a hosted runtime without changing product contracts:

- validated request/response schemas shared with the browser where practical
- loopback development server and an explicit production adapter boundary
- static asset allowlist; no repository, `.env`, Git, or server-source exposure
- same-origin/Host checks, JSON and size limits, timeouts, concurrency and quota limits
- provider credentials read only from environment; no browser key entry
- deterministic scheduler and fact generation on the server
- optional provider calls limited to constraint interpretation and selection of validated fact IDs
- sanitized operational logs and visible failure states
- persistence interface for immutable plan snapshots, revisions, ownership, export, and deletion, with local storage as the current adapter

Do not add accounts, cloud storage, queues, embeddings, browsing, multi-agent behavior, or deployment provisioning in this update. Leave clean seams for them and document the substitution point.

## Acceptance criteria

These cases are the minimum product contract. Prefer small runnable Node checks and one browser flow over a large test framework.

1. Importing a valid export previews context and courses; confirmation is required before the workspace changes.
2. Mixed terms or institutions are rejected; unknown context remains visible and requires acknowledgement.
3. A goal such as “no Friday classes, nothing before 10, at most 16 credits” becomes editable constraints and does not apply automatically.
4. Ambiguous input such as “keep math” produces a clarification request; unsupported fit claims such as “prepare for ML” remain unresolved without course evidence.
5. Required-course conflicts, duplicate sections, excluded courses, TBA meetings, credit limits, unavailable days, and earliest-start rules are handled deterministically with visible reasons.
6. A suggestion preview does not mutate the draft; only an explicit apply action changes selection.
7. Changing the draft or goal invalidates an outstanding interpretation or suggestion; a late response cannot apply.
8. Provider refusal, timeout, malformed output, missing credentials, exhausted quota, invalid Origin/Host, and oversized requests preserve manual planning and reveal no secret or stack trace.
9. Saving and reopening preserves context, constraints, selection, comparison data, and uncertainty; legacy snapshots load without destructive rewriting.
10. Browser acceptance passes at desktop and narrow mobile widths: sample/import → consent → goal → review → preview → apply → save → reload → reopen, with keyboard-only operation and no provider request before consent.
11. The live synthetic smoke test completes one real provider-backed path when credentials are configured; otherwise the report clearly separates mocked/local evidence from the unverified live gate.

## Definition of nearly ready

The result is nearly a landing product when the core journey is coherent in the browser, the visual direction is represented in the UI, frontend and backend contracts are documented and tested, local persistence can be swapped for an account-backed adapter, and the remaining work is deployment, real account/persistence integration, evidence curation, and live operational validation rather than a redesign of the core flow.
