# Web import MVP

Saved plans provide Open, Export and Delete actions. Export downloads a version 1
JSON file with courses, selection, context and confirmed rules. Importing that file
requires another preview and context review. Delete asks for confirmation and
removes only the chosen saved copy; the active draft is unchanged.

The storage functions accept an explicit storage adapter. Local copies belong to
this browser origin, not an authenticated user. A hosted adapter must enforce
ownership on the server and use immutable IDs as revisions; browser-supplied
ownership is never authorization. Export and deletion must stay scoped to the
authenticated owner when that later integration is implemented.

From the repository root, run `npm run dev:web`, then open http://127.0.0.1:4175/apps/web/. See [server setup](../../server/README.md) for optional AI credentials.

Export JSON from the extension, choose the file, review the counts, and confirm. Select courses to see meetings, known overlaps, credits and contact hours. “Try sample courses” needs no extension. This static prototype uses existing calendar utilities and no added dependencies.

Draft data lives in tab memory. “Save a copy” stores an immutable named snapshot in localStorage on this origin. Saved copies can be reopened after reload; drafts are not autosaved. Manual planning stays local. Optional AI interpretation sends only the fields listed in its consent notice. Clearing site data removes saved copies; this is not cloud backup. This is a weekly agenda, not a time-proportional calendar. TBA meetings are flagged, and academic requirements are not verified. Accounts and cloud persistence are not implemented. AI interpretation is optional; the scheduler remains deterministic. Run `node apps/web/saved-plans.test.js` for snapshot storage checks.

Check the import boundary with `node apps/web/import.test.js`. The Node server allowlists the shared calendar modules needed by the app.

Typography: locally hosted Inter, with its license included in `fonts/`. Import controls collapse after confirming courses and can be reopened at any time.

After saving two copies, open “Compare saved plans” to see selected-course differences, credits, known class hours, and unconfirmed times. Changed course records appear on both sides. Run `node apps/web/compare.test.js` to check comparison logic.

“Suggest a schedule” respects a maximum credit limit and earliest meeting time, excludes unknown meetings and duplicate sections, and previews skipped-course reasons before application. It uses a greedy pass, checked courses first: it does not optimize all combinations or provide AI/academic advice. Check with `node apps/web/suggest.test.js`.

### Schedule rules

Under **Suggest a schedule**, choose days off and set each course to Consider,
Required, or Exclude. Required courses take priority over checked courses and must
satisfy all time, credit, and overlap rules. An impossible required selection shows
an error instead of silently dropping a course. Review the preview and use **Use
this selection** to change the agenda. Editing rules invalidates the previous preview.

Saved copies now retain these rules. Older copies open with defaults without
rewriting their stored data. Suggestions remain deterministic and local; natural
language AI interpretation proposes editable rules after consent.

### Planning context

Imports preserve supplied term, institution, campus and time zone. Mixed known
contexts are rejected. Before suggesting, review the context notice and explicitly
acknowledge missing details. Unknown fields remain unknown after acknowledgement;
meeting dates and current offerings are not verified. New saves retain the context
and acknowledgement. Legacy records load without being rewritten.

Additional check: `node apps/web/planning-context.test.js`.

### Server suggestions and explanations

**Preview with explanation** requires a separate data-use acknowledgement. The
local server receives the course snapshot and computes the schedule. Zhipu GLM, when
configured, receives only calculated facts and chooses which to highlight. If AI
is unavailable, the same candidate and deterministic facts remain reviewable.
Nothing changes the agenda until **Use this selection**. Editing the draft discards
outstanding results; applying rechecks the current rules. Goal text is not sent
in explanation requests. Run `npm run test:web-ai` for endpoint and fallback checks.
