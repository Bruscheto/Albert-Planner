## Context

- The side panel is `popup.html?mode=sidepanel` (`src/popup/`). Cart data comes from `src/content/albert-intake.js` → `src/storage/course-storage.js`.
- `src/planner/planner.js#generateOptimalSchedule` is greedy by bucket priority and ignores constraints.
- `apps/web/suggest.js#suggestSchedule` is greedy with constraints. `apps/web/constraints.js` and `apps/web/ai-contract.js` hold validated contracts and the interpretation schema. Those are the parts worth reusing.
- `server/openai.js` holds the interpretation prompt. Its rules carry over: untrusted course text, null for unchanged fields, ask instead of guessing on ambiguous references, no invented IDs.

## Decisions

### D1. On-device interpretation (Chrome Prompt API), no hosted fallback in this change

| Option | Cost | Privacy | Reach | Ops |
|---|---|---|---|---|
| **Chrome built-in Prompt API** | Free | Data stays on device | Only supported desktops with enough GPU/RAM/disk | None |
| Hosted proxy (e.g. Vercel function + provider key) | Per request | Course list leaves the device; needs a policy update | All users | Rate limiting, abuse, key rotation |
| Bring-your-own key | User pays | Key stored in extension | Tiny | Key UX |

The Prompt API is stable for extensions (Chrome 138+). Third-party guides put the requirements at roughly >4 GB VRAM, or 16 GB RAM with 4 cores, plus ~22 GB free disk. Verify against developer.chrome.com at implementation time. **Risk:** many students have 8 GB laptops. That is why task 1.1 is a spike. If fewer than about half of the test machines report `available` or `downloadable`, stop and revisit D1 with a hosted proxy. Do not ship a goal box most users can't use.

Interpretation call (verify exact API at implementation):
- `LanguageModel.availability()` → `unavailable | downloadable | downloading | available`. Show each state in the UI. Download only on an explicit user click.
- `session.prompt(input, { responseConstraint: interpretationSchema })` returns JSON matching the existing schema. It is still validated with `validateInterpretation(output, current, courses)`; schema-shaped output is not trusted output.
- Hard timeout of 10 s via `AbortController`. On timeout, refusal or invalid output, the controls are unchanged and an inline message appears. No automatic retry.

### D2. Bounded complete search replaces greedy

- **Variables:** one choice per course code, from that code's sections plus "not taken". Locked courses must be taken; excluded sections are removed.
- **Pruning:** time conflicts (`calendar-utils#hasConflict`), unavailable days, earliest start, credit ceiling, TBA meetings. A TBA section is never auto-picked; it appears as an unknown with a reason.
- **Ranking (lexicographic):** all required courses satisfied → more selected-cart courses → credits closest to the ceiling without exceeding it → fewer class days → later earliest start. This order is fixed and shown as "sorted by …", so the result never claims to be "best" or "optimal".
- **Limit:** stop after 50,000 explored nodes. If the search hits the limit, the result says "Search stopped early — results may be incomplete", never "no schedule fits".
- Return the top 3 distinct alternatives. Expected cart size is ≤ 15 course codes, so the limit should rarely trigger. Add a fixture that proves the truncation path.

### D3. Explanations are computed, not generated

The extension does not port the web prototype's LLM explainer. Each alternative carries facts: credits, days, earliest start, and per-course status with a reason. The UI renders them from templates. This drops a model call and removes the factuality risk entirely.

### D4. Module layout

- `src/shared/constraints.js` (moved from `apps/web/constraints.js`; `apps/web` imports it from the new path).
- `src/shared/ai-contract.js` (same move).
- `src/planner/search.js` (new, pure, unit-tested).
- `src/planner/goal-interpreter.js`: Prompt API adapter with an injected `languageModel` for tests.
- `src/popup/constraints-panel.js`: controls, goal box and proposal diff.

### D5. Data and privacy

- Constraints are saved per term in `chrome.storage.local`, additively. Existing snapshots load unchanged.
- Goal text is not persisted by default.
- Local counters (`goalProposals`, `goalConfirmed`, `goalDiscarded`, `searchRuns`, `searchTruncated`) are stored locally, shown in Settings, and can be copied into the feedback form. Nothing is transmitted.

## Risks

- **Hardware reach** (D1): mitigated by the spike gate.
- **Model quality** on small on-device models: mitigated by schema-constrained output, server-side-style validation in the client, clarification questions, and a fixture suite (task 3.4).
- **Prompt injection via course titles** from Albert pages: course text is passed as data. The output can only contain known IDs and enum values, and validation rejects anything else.
