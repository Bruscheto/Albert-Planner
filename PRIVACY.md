# Albert Planner — Privacy Policy

_Last updated: 2026-09-22_

The Albert Planner extension stores your planning data locally. The optional web AI preview has a separate data flow described below.

- **What it accesses:** course information (course name, meeting times, instructor, room, credits) from your NYU Albert shopping cart, only on `sis.nyu.edu` and `sis.portal.nyu.edu`.
- **Where it's stored:** locally in your browser via `chrome.storage`. Your shopping cart and bucket data never leave your device and are never sent to any server we control.
- **Extension analytics:** none. The extension does not use the optional web AI service.
- **Third-party requests:**
  - **RateMyProfessors:** to display professor ratings, the extension queries `ratemyprofessors.com` using the instructor's name and the course code from your cart. Only the professor name and course code are sent — no information about you is included. Results are cached locally in your browser.
  - **Google Fonts:** the extension loads fonts from Google Fonts for styling.
  - Links you choose to click (e.g. a Google search for a course) open in your browser as normal.
- **Removal:** uninstalling the extension or clearing its storage deletes all locally stored data.

Contact: zz4917@nyu.edu

## Optional local web AI preview

Manual course import, schedule suggestions and named saves remain in your browser.
The local Node server serves the website on loopback. After you acknowledge the
planning context and agree to the data notice, choosing **Interpret goal** sends
Zhipu GLM your goal text, current constraints, course IDs/codes/titles/sections, and
term/institution/campus/time-zone context. Meeting times, saved-plan names, full
exports and extension caches are not included in interpretation requests.

The server does not persist or log goals or provider payloads. Goal prose is not
saved with named plans. API credentials stay in the local server environment.
Requests use the official BigModel chat-completions API; retention depends on
your API account and applicable provider policies. This preview does not promise zero retention.
Do not enter personal information in goals. Clearing this web origin's site data
removes its saved plans; extension storage is separate.

Choosing **Preview with explanation**, after its separate acknowledgement, sends
course and meeting records, selection, rules and planning context to the local
loopback server. The server computes the schedule and sends Zhipu GLM only calculated
facts: totals, meeting days/start times, course codes/sections, exclusion reasons
and unknown-context notices. Goal prose and the full course snapshot are not sent
to Zhipu GLM in this step. The model selects existing fact IDs; the browser renders
server-calculated text. AI failure leaves the deterministic result available.
