## 0. Preconditions
- [ ] 0.1 Commit `server/`, `apps/web/`, `openspec/changes/add-web-ai-planner/` and the current modified files as the reference implementation (separate commit, before this change).
- [ ] 0.2 Fix `server/.env` variable names (`OPENAI_*` → `GLM_*`), then run `pnpm check:web-ai:live` once and record the result in `server/README.md`.

## 1. Gate: on-device feasibility
- [ ] 1.1 Spike: a throwaway side-panel page that logs `LanguageModel.availability()` and runs one schema-constrained interpretation. Try it on at least 3 typical student laptops (include an 8 GB machine). Record the device, the state and the latency.
- [ ] 1.2 Decision: if fewer than half of the machines are `available`/`downloadable`, stop and revise D1 before continuing.

## 2. Shared contracts and search
- [ ] 2.1 Move `constraints.js` and `ai-contract.js` to `src/shared/` and update `apps/web` imports. Existing web tests stay green.
- [ ] 2.2 Implement `src/planner/search.js` (D2) with unit tests: greedy-miss fixture, required-course failure, TBA handling, credit ceiling, unavailable day, truncation at the node limit, and a deterministic ranking order.
- [ ] 2.3 Add computed facts and explanation templates (D3), with tests.

## 3. Side panel
- [ ] 3.1 Constraint controls with per-term persistence (additive storage; v1 data loads unchanged).
- [ ] 3.2 Alternatives view: preview, apply with freshness recheck, stated sort order.
- [ ] 3.3 Goal box: availability states, explicit download, 10 s timeout, proposal diff, confirm/discard, clarification and unresolved display.
- [ ] 3.4 Interpretation fixture suite (about 15 goals: common preferences, ambiguity, contradictions, fit goals, injection in course titles) run against an injected fake model in CI, plus a manual on-device run with results recorded.

## 4. Feedback and release
- [ ] 4.1 Local counters (D5), a Settings view, and a "Send feedback" link.
- [ ] 4.2 Update `PRIVACY.md` and the store listing copy; bump the version to 1.3.
- [ ] 4.3 Browser check: import cart → controls → goal → confirm → alternatives → apply, at side-panel width, keyboard only. Confirm no network requests come from this feature.
- [ ] 4.4 Recruit 5 students for the spring registration window and record what they did and where they got stuck.

## Evidence
(fill in at completion: test counts, spike table, fixture pass rate, on-device latency p50/p90)
