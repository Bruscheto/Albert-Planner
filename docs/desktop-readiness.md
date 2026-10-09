# Desktop delivery status

The desktop hierarchy is approved for this increment. Mobile work and the larger visual redesign are deferred by user direction. Deployment and cloud accounts remain outside this increment.

## Verified

- The browser sample flow previews course names and unknown context before confirmation.
- Manual context acknowledgement, suggestion preview, explicit application, save, reload, and reopen were exercised in the desktop browser.
- The 23 offline web/server tests cover import validation, constraints, persistence, comparisons, stale responses, provider failure, endpoint boundaries, and synthetic acceptance.
- GLM output receives the expected schema in its prompt and is validated by application code. JSON mode alone is not treated as schema enforcement.

## Remaining evidence and implementation

- Live GLM-5.2 acceptance passed all five cases with four provider requests: constraints, ambiguity, unsupported goals, grounded explanation, and save/restore. Extended reasoning is disabled for these bounded JSON tasks; earlier runs failed explanation validation or timed out. Browser AI interaction remains a separate gate.
- Desktop live GLM browser flow passed: consent rejection before opt-in, interpreted four-credit/10am/Friday rules, explicit rule confirmation without agenda mutation, grounded explanation, explicit application, save, reload and reopen. Reopened controls retained all three rules. Return/Space activation and context focus were exercised; a complete keyboard accessibility audit is not claimed.
- Browser-check the newly implemented saved-plan export/deletion controls. Offline export and scoped deletion tests pass. Current snapshots are local, immutable copies; they do not implement authenticated ownership.
- Complete a requirement-by-requirement audit before claiming the product update finished.

## Local commands

`npm run dev:web` and `npm run check:web-ai:live` load the ignored `server/.env` when present. Configure `GLM_API_KEY`, `GLM_MODEL=glm-5.2`, and `GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4`. Never put a key in `.env.example`.

The live check uses synthetic records, permits at most four provider calls, makes no automatic retries, and fails if grounded explanation falls back instead of completing a real call.
