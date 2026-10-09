## 0. Preconditions
- [x] 0.1 Commit `server/`, `apps/web/`, `openspec/changes/add-web-ai-planner/` and the current modified files as the reference implementation (separate commit, before this change).
- [ ] 0.2 Fix `server/.env` variable names (`OPENAI_*` → `GLM_*`), then run `pnpm check:web-ai:live` once and record the result in `server/README.md`.

## 1. Gate: on-device feasibility
- [ ] 1.1 Spike: a throwaway side-panel page that logs `LanguageModel.availability()` and runs one schema-constrained interpretation. Try it on at least 3 typical student laptops (include an 8 GB machine). Record the device, the state and the latency.
- [ ] 1.2 Decision: if fewer than half of the machines are `available`/`downloadable`, stop and revise D1 before continuing.

## 2. Shared contracts and search
- [x] 2.1 Move `constraints.js` and `ai-contract.js` to `src/shared/` and update `apps/web` imports. Existing web tests stay green.
- [x] 2.2 Implement `src/planner/search.js` (D2) with unit tests: greedy-miss fixture, required-course failure, TBA handling, credit ceiling, unavailable day, truncation at the node limit, and a deterministic ranking order.
- [x] 2.3 Add computed facts and explanation templates (D3), with tests.

## 3. Side panel
- [x] 3.1 Constraint controls with per-term persistence (additive storage; v1 data loads unchanged).
- [x] 3.2 Alternatives view: preview, apply with freshness recheck, stated sort order.
- [x] 3.3 Goal box: availability states, explicit download, 10 s timeout, proposal diff, confirm/discard, clarification and unresolved display.
- [~] 3.4 Interpretation fixture suite (about 15 goals: common preferences, ambiguity, contradictions, fit goals, injection in course titles) run against an injected fake model in CI, plus a manual on-device run with results recorded.

## 4. Feedback and release
- [x] 4.1 Local counters (D5), a Settings view, and a "Send feedback" link.
- [x] 4.2 Update `PRIVACY.md` and the store listing copy; bump the version to 1.3.
- [~] 4.3 Browser check: import cart → controls → goal → confirm → alternatives → apply, at side-panel width, keyboard only. Confirm no network requests come from this feature.
- [ ] 4.4 Recruit 5 students for the spring registration window and record what they did and where they got stuck.

## Evidence

Status markers: `[x]` done, `[~]` done except the part that needs real hardware or people, `[ ]` open.

- **Tests** (`pnpm test`): 10 suites pass, 3 of them new.
  - `schedule-search`: greedy-miss fixture, required failures (day, start, overlap, credits, two sections), TBA, credit ceiling, days and start, enrolled, deterministic top 3, truncation at the node limit, freshness. A randomized cross-check matches exhaustive enumeration on 150 random carts.
  - `goal-interpreter`: 15 interpretation fixtures against a fake model, all passing. They cover common preferences, ambiguity, fit goals, a specific course, explicit clear, no-op, invented ID, contradiction, out-of-range credits, injection in course titles, unknown day, malformed JSON, refusal, blank notes, and the data/schema sent. Separate checks cover timeout, cancellation, input bounds, availability states, explicit download, and partial apply.
  - `planning-storage`: per-term rules, additive storage, stale IDs, counters.
- **Web prototype after the contract move** (`pnpm test:web`): 23/23.
- **Search cost**: a synthetic 15-course × 3-section cart finishes in about 14k nodes (~15 ms). 15 × 4 and 20 × 3 hit the 50,000 limit and show the truncation banner.
- **Browser check (4.3)**: in the test harness, keyboard only: goal → Ctrl+Enter → proposal → apply → generate → apply option. The planner tray updated, and no network requests were made during the flow. The built `dist/` loaded in Chromium rendered the side panel and produced 3 options with no console errors and no network requests. Not yet done on a real Albert page in Chrome with the real model.
- **Spike (1.1) / on-device run (3.4)**: not done. It needs real student laptops. To make it a two-minute task per laptop, Settings → **on-device AI check** reports availability, the browser and reported RAM, and, when the model is ready, the latency and correctness of one sample goal. It never downloads, and the result is copyable. Chromium in CI reports `downloadable`.

