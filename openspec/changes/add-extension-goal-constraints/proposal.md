## Why

Albert Planner has Chrome Web Store installs, but we have no feedback and no usage signal. What a student does in the side panel today is look at their cart as a calendar and see conflicts. Building a schedule that fits their constraints ("no Friday classes, nothing before 10, at most 16 credits, I must take CSCI-UA 202") is still manual trial and error across sections.

The web prototype (`apps/web/` + `server/`) already proved the interpretation contract: natural language goes in, an editable constraint patch comes out, and nothing applies until the student confirms. But it lives outside the extension, needs a local Node server and a provider key, and has no real users. The greedy scheduler behind it can also report "doesn't fit" when a feasible combination exists. Constraints only help if the search that consumes them is complete.

This change brings goal-based planning to the users we already have, inside the extension. It needs no server and no API key, and student data does not leave the device.

## What Changes

- **Manual constraint controls in the side panel** (always available): max credits, earliest start, unavailable days, required courses, excluded courses. Shared validation moves from `apps/web/constraints.js` to `src/shared/`.
- **Goal box**: a plain-language goal becomes a *proposed* constraint patch, shown as a diff against the current controls. The student edits it and confirms; nothing auto-applies. Interpretation runs on-device through Chrome's built-in Prompt API (Gemini Nano) with a JSON-schema response constraint. If the model is unavailable, the goal box explains why and the manual controls keep working.
- **Complete, bounded schedule search**: replaces the greedy pass with a search over section choices per course. It honors constraints, returns up to 3 ranked alternatives, and reports when the search was truncated instead of claiming no fit exists.
- **Rule-generated explanations**: every alternative lists why each course was included, skipped or unknown (TBA). The text comes from computed facts, with no LLM prose.
- **A lightweight feedback channel**: a "Send feedback" link in the side panel, and local-only counters the student can view and copy. No telemetry is sent.

## Preconditions (do first)

1. Commit the existing web prototype (`server/`, `apps/web/`, `openspec/changes/add-web-ai-planner/`) as the reference implementation, so the shared contracts have a history.
2. Fix `server/.env`: it defines `OPENAI_*` but the server reads `GLM_*`, so the prototype's AI path is silently disabled.
3. Run the hardware spike (task 1.1) before building the goal box UI.

## Capabilities

### New Capabilities
- `goal-constraints`: Side-panel constraint controls, on-device goal interpretation, confirm-before-apply.
- `schedule-search`: Bounded complete search over section combinations with ranked alternatives and explicit truncation.

## Non-goals

- Hosted AI proxy or any server the extension calls (see design decision D1 for when to revisit).
- Course-quality or career-fit recommendations ("is this course good for ML"). These stay unresolved without course-content evidence.
- Auto-registration or writing to Albert.
- Accounts, sync or analytics telemetry.

## Impact

- Extension side panel UI, `src/planner/`, `src/shared/`. Manifest permissions are unchanged unless the spike shows the Prompt API needs a declaration.
- `PRIVACY.md`: state that goal text is processed on-device by Chrome's built-in model and is not sent anywhere.
- Store listing copy update and a version bump to 1.3.

## Success signals

- Qualitative: 5 NYU students try it during the spring registration window. At least 3 of them build a schedule with the goal box or controls without help.
- Product: in local counters, the share of planner sessions that use constraints, and the share of proposals that are confirmed rather than discarded.
- Correctness: for every fixture where a feasible combination exists, search finds it (greedy is the baseline to beat).
