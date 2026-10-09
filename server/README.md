# Local AI interpretation server

Requires Node 22+. No additional dependencies. From the repository root:

```sh
npm run dev:web
```

Open http://127.0.0.1:4175/apps/web/. Manual import, planning and saves work without
credentials. For optional AI, copy `server/.env.example` to `server/.env`, supply
`GLM_API_KEY` and an `GLM_MODEL` available to your project with JSON output support, then run:

```sh
node --env-file=server/.env server/index.js
```

Do not paste credentials into the browser or commit the populated environment file.
The server only binds to 127.0.0.1. It is a local development service, not a public
service: no accounts, production authentication or distributed quotas exist.
It serves an exact asset allowlist, not the repository directory. Use this server
instead of the earlier Python repository-root preview. Browser saves are scoped
to the origin; copies saved at port 4173/4174 remain there and are not auto-migrated.

## Behavior and limits

GLM-5.2 requests disable extended reasoning for the bounded JSON tasks. This
setting was verified with the live synthetic acceptance suite; do not substitute
a model that requires thinking without revisiting the adapter and timeout budget.

The server uses the official GLM API. Set `GLM_API_KEY`, `GLM_MODEL` (for example `glm-5.2`), and optionally `GLM_BASE_URL` (default `https://open.bigmodel.cn/api/paas/v4`).

`GET /api/health` is a dependency-light readiness check and returns `{ok:true,aiEnabled}`.
`GET /api/ai/status` reports whether credentials and model are configured plus the remaining session budget.
`POST /api/ai/interpret` validates a goal and allowlisted course/context fields,
then returns proposed constraints and unresolved/ambiguous goals. It never changes
or stores a plan. The browser requires data-use consent and context acknowledgement,
shows editable proposed rules alongside current values, then waits for explicit
confirmation. The local preview remains available. A separate **Preview with explanation** action
posts the course snapshot, rules and context to `/api/ai/suggest`. The server
revalidates them and runs the same deterministic scheduler. It computes a fact
table and sends only those facts to the explanation model, which may select up to
six existing fact IDs. It cannot supply factual prose. The UI always shows unknowns
and exclusion reasons even if the model does not select them.

Missing credentials, busy/quota states, timeout or invalid explanation output
return the deterministic candidate with a visible fallback notice. Both AI routes
share one request budget and concurrency limit. The browser checks the returned
course IDs against a locally recomputed candidate and checks again before applying.
Any rule, selection, goal or context edit invalidates the outstanding result.
Candidates are greedy combinations, not optimal schedules or academic advice.

- Exact loopback Host and same-origin mutation Origin; no CORS.
- JSON only; 256 KiB body, 2,000-character goal, 100 courses.
- One generation at a time, 20 attempts per process session, 25-second timeout.
- Failed attempts count; no automatic retries. Restart clears the session counter.
- Disconnect aborts the provider request. The browser aborts superseded requests
  and rejects outdated replies/proposals. Proposals expire after 10 minutes.
- No request bodies, API responses or goals in server logs; no server persistence.
- Keys stay server-side. GLM calls set `store:false`; this does not promise
  zero provider retention. Account-level provider policies still apply.

API syntax verified against [official GLM structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

## Verification

Run `npm run test:web-ai` for HTTP boundaries, limits, cancellation, output validation,
provider adapter and client request revision checks. These use mocks and make no
paid calls. Also run the five `apps/web/*.test.js` suites for the existing planner.
Browser QA used a temporary injected synthetic interpreter, not a real model.
Semantic interpretation quality (including ambiguity and unsupported aspirations)
still needs live evaluation; structural validation alone cannot prove it.

Live smoke test outstanding: with credentials configured, use only sample courses,
confirm context, enter “No Friday classes, nothing before 10am, at most 4 credits”,
consent, interpret, inspect/edit proposed rules, confirm, preview, apply, save,
reload and reopen. Also test ambiguous course references and unsupported ML goals.
Never mark this live gate complete based on mocked output.

### Repeatable acceptance commands

Run every web/server check without credentials or network model calls:

```sh
npm run test:web
```

After configuring `server/.env`, explicitly run the paid synthetic acceptance gate:

```sh
node --env-file=server/.env server/live-check.js --live
```

If credentials are already exported into the shell, use `npm run check:web-ai:live`.
This starts an isolated loopback server on a temporary port, permits at most four
model calls with no retries, then shuts it down. No real exports, browser storage,
or personal data are loaded. Only case names and pass/fail status are printed.
Missing credentials exit with code 2 without making a provider request; a failed
acceptance exits with code 1. A successful run exits with code 0.

The live cases require clear preferences to normalize exactly, ambiguous math
references to ask for clarification without selecting a course, career preparation
to remain unresolved, and explanation generation to succeed with known fact IDs.
Deterministic fallback does **not** pass the live explanation check. Snapshot
persistence is checked using in-memory storage; actual browser consent, keyboard,
responsive layout and save/reload checks remain separate. Short unresolved-goal
text still needs human review for semantic correctness.
