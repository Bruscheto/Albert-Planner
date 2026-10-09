// Side-panel goal planner: manual rules, on-device goal box, and ranked
// schedule options. Nothing here changes the planner until the student
// confirms a proposal or applies an option.

import { DAYS } from "../shared/constraints.js";
import { createRequestState } from "../shared/request-state.js";
import { STORAGE_KEYS } from "../shared/constants.js";
import {
	hasUnconfirmedMeetings,
	isEnrolled,
	normalizeCourseCode,
	planInputsFingerprint,
	searchSchedules,
} from "../planner/search.js";
import {
	courseLabel,
	describeFailure,
	diffAlternatives,
	explainAlternative,
	formatCredits,
	formatMinutes,
	sortOrderText,
	summarizeFacts,
} from "../planner/explanations.js";
import {
	MAX_GOAL_LENGTH,
	applyChanges,
	checkAvailability,
	downloadModel,
	getLanguageModel,
	interpretGoal,
} from "../planner/goal-interpreter.js";
import {
	incrementCounter,
	loadConstraints,
	resolveTermKey,
	saveConstraints,
} from "../storage/planning-storage.js";
import {
	getCourses,
	getPlannerSelection,
	setPlannerSelection,
} from "../storage/course-storage.js";

const DAY_LETTERS = { Mon: "M", Tue: "T", Wed: "W", Thu: "R", Fri: "F", Sat: "S", Sun: "U" };
const EARLIEST_CHOICES = [0, 480, 510, 540, 570, 600, 630, 660, 690, 720, 780];
const OPTION_NAMES = ["A", "B", "C"];
// Distinct, colorblind-aware hues (Tableau 10). A course keeps its color
// across options because colors are assigned per cart, not per option.
const COURSE_COLORS = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#76b7b2", "#edc948", "#9c755f", "#ff9da7", "#bab0ac"];
const STRIP_MIN_HOURS = 6;
// Goals in scripts other than Latin are passed through, but Chrome's
// on-device model is tuned for English, so the student is told to check.
const NON_LATIN_SCRIPT = /[\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

/** Small DOM builder. Text is always set with textContent. */
function h(tag, props = {}, ...children) {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null || value === false) continue;
		if (key === "class") el.className = value;
		else if (key === "text") el.textContent = value;
		else if (key === "dataset") Object.assign(el.dataset, value);
		else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
		else if (value === true) el.setAttribute(key, "");
		else el.setAttribute(key, String(value));
	}
	for (const child of children.flat()) {
		if (child === null || child === undefined || child === false) continue;
		el.append(child instanceof Node ? child : document.createTextNode(String(child)));
	}
	return el;
}

function meetingSummary(course) {
	if (hasUnconfirmedMeetings(course)) {
		const timed = (course.components ?? []).find((part) => part.timeRange && part.days?.length);
		return timed
			? `${timed.days.join(" ")} ${formatMinutes(toMinutes(timed.timeRange.start))} · some times TBA`
			: "times TBA";
	}
	const first = course.components[0];
	const extra = course.components.length > 1 ? ` +${course.components.length - 1}` : "";
	return `${first.days.join(" ")} ${formatMinutes(toMinutes(first.timeRange.start))}${extra}`;
}

function toMinutes(time) {
	return time.hours * 60 + time.minutes;
}

/**
 * One color per course code for a set of results. Codes are colored in the
 * order they first appear across the options, so the courses side by side in
 * option A always get the most distinct colors, and a course keeps its color
 * in every option. Past the palette, colors fall back to a hashed hue.
 * @param {string[][]} optionCourseCodes - Course codes per option, in order.
 * @param {object[]} courses - Every course, for codes not in any option.
 * @returns {Map<string, string>}
 */
function courseColors(optionCourseCodes, courses) {
	const codes = [...new Set([
		...optionCourseCodes.flat(),
		...courses.map((course) => normalizeCourseCode(course.courseCode)).sort(),
	])];
	return new Map(codes.map((code, index) => {
		if (index < COURSE_COLORS.length) return [code, COURSE_COLORS[index]];
		let hash = 0;
		for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return [code, `hsl(${hash % 360} 55% 52%)`];
	}));
}

function earliestLabel(minutes) {
	return minutes === 0 ? "any time" : formatMinutes(minutes);
}

/**
 * Mount the goal planner into `root`. Call `refresh()` whenever the course
 * session may have changed.
 * @param {HTMLElement} root
 */
export function mountGoalPlanner(root) {
	const requests = createRequestState();
	const languageModel = getLanguageModel();
	const state = {
		allCourses: [],
		courses: [],
		selection: [],
		termKey: null,
		constraints: null,
		coursesKey: "",
		availability: "checking",
		downloadProgress: null,
		proposal: null,
		openNotes: null,
		options: null,
		appliedIndex: null,
	};

	// ---- Static skeleton -------------------------------------------------
	const goalInput = h("textarea", {
		id: "goal-text",
		class: "goal-input",
		rows: "3",
		maxlength: String(MAX_GOAL_LENGTH),
		placeholder: "e.g. no Friday classes, nothing before 10, at most 16 credits",
		"aria-describedby": "goal-availability",
	});
	const goalSubmit = h("button", { type: "submit", class: "btn-primary goal-submit" }, "propose rules");
	const availabilityLine = h("p", { id: "goal-availability", class: "goal-availability", "aria-live": "polite" });
	const downloadRow = h("div", { class: "goal-download", hidden: true });
	const goalStatus = h("p", { class: "goal-status", role: "status", "aria-live": "polite" });
	const proposalArea = h("div", { class: "goal-proposal-area" });
	const notesArea = h("div", { class: "goal-notes-area" });
	const goalLabel = h("label", { for: "goal-text", class: "goal-label" }, "describe what you want");
	const goalForm = h(
		"form",
		{ class: "goal-box", onsubmit: onGoalSubmit },
		goalLabel,
		goalInput,
		h("div", { class: "goal-actions" }, availabilityLine, goalSubmit),
		downloadRow,
		goalStatus,
	);

	const rulesSummary = h("span", { class: "rules-summary" });
	const rulesMessage = h("p", { class: "rules-message", role: "alert", hidden: true });
	const rulesBody = h("div", { class: "rules-body" });
	const rulesDetails = h(
		"details",
		{ class: "rules-panel" },
		h("summary", { class: "rules-toggle" }, h("span", { class: "rules-title" }, "rules"), rulesSummary),
		rulesMessage,
		rulesBody,
	);

	const generateButton = h("button", { type: "button", class: "btn-secondary btn-accent goal-generate", onclick: onGenerate }, "generate schedules");
	const optionsArea = h("div", { class: "goal-options" });
	// One short announcement per search instead of reading every card aloud.
	const optionsAnnouncer = h("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
	const termNotice = h("p", { class: "goal-term-notice", hidden: true });

	root.replaceChildren(termNotice, goalForm, proposalArea, notesArea, rulesDetails, generateButton, optionsAnnouncer, optionsArea);

	goalInput.addEventListener("input", () => {
		// Editing the goal makes an outstanding proposal or request stale.
		if (state.proposal || goalSubmit.dataset.busy === "true") cancelProposal("");
	});
	goalInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			goalForm.requestSubmit();
		}
	});

	chrome.storage?.onChanged?.addListener((changes, namespace) => {
		if (namespace === "local" && changes[STORAGE_KEYS.GOAL_CONSTRAINTS]) refresh();
	});

	refreshAvailability();

	// ---- Data -----------------------------------------------------------
	// Storage events and explicit calls can overlap; only the newest refresh
	// may write state, so an older read never overwrites a newer one.
	let refreshSeq = 0;
	async function refresh() {
		const seq = ++refreshSeq;
		const [allCourses, selection, termResult] = await Promise.all([
			getCourses(),
			getPlannerSelection(),
			chrome.storage.local.get(STORAGE_KEYS.ACTIVE_TERM),
		]);
		if (seq !== refreshSeq) return;
		const activeTerm = termResult[STORAGE_KEYS.ACTIVE_TERM] ?? null;
		const termKey = resolveTermKey(allCourses, activeTerm);
		state.allCourses = allCourses;
		state.selection = selection;
		state.termKey = termKey;
		state.courses = termKey === null ? [] : allCourses;

		let constraints = null;
		let dropped = [];
		if (termKey !== null && allCourses.length) {
			({ constraints, droppedIds: dropped } = await loadConstraints(termKey, allCourses));
			if (seq !== refreshSeq) return;
			// Persist the cleanup once so the notice doesn't repeat.
			if (dropped.length) await saveConstraints(termKey, constraints, allCourses);
		}
		if (!state.courses.length) state.options = null;
		const coursesKey = planInputsFingerprint(state.courses, constraints);
		const changed = coursesKey !== state.coursesKey;
		state.constraints = constraints;
		state.coursesKey = coursesKey;

		if (changed) {
			if (state.proposal) cancelProposal("Your cart or rules changed, so the proposal was discarded.");
			else if (goalSubmit.dataset.busy === "true") cancelProposal("Your cart or rules changed, so that request was cancelled. Propose rules again.");
			else requests.invalidate();
			if (state.options) state.options.stale = true;
			renderRules();
		}
		if (dropped.length) {
			showRulesMessage(`${dropped.length === 1 ? "A rule" : `${dropped.length} rules`} referred to courses no longer in your cart and ${dropped.length === 1 ? "was" : "were"} removed.`, "info");
		}
		renderFrame();
		renderOptions();
	}

	function renderFrame() {
		const hasCourses = state.courses.length > 0;
		termNotice.hidden = state.termKey !== null;
		termNotice.textContent = "Your courses span more than one term. Fetch a single term from Albert to plan with goals.";
		goalForm.hidden = !hasCourses;
		rulesDetails.hidden = !hasCourses;
		generateButton.hidden = !hasCourses;
		if (!hasCourses && state.termKey !== null) {
			optionsArea.replaceChildren(
				h("p", { class: "empty-state-text-small" }, "// fetch your cart to plan with goals"),
			);
		}
		updateGoalControls();
	}

	// ---- Availability -----------------------------------------------------
	let downloadInFlight = false;
	async function refreshAvailability() {
		state.availability = await checkAvailability(languageModel);
		renderAvailability();
		// A download Chrome started elsewhere has no progress events here, so
		// check back until it finishes.
		if (state.availability === "downloading" && !downloadInFlight) {
			setTimeout(refreshAvailability, 5000);
		}
	}

	function renderAvailability() {
		const messages = {
			checking: "checking on-device AI…",
			available: "runs on this device · goal text never leaves it",
			downloadable: "needs Chrome's on-device model, a one-time download",
			downloading: "downloading the on-device model…",
			unavailable: "Describing goals needs Chrome's on-device AI, which this computer doesn't support. Set rules below; the schedule search works the same.",
			unsupported: "Describing goals needs Chrome's built-in AI (desktop Chrome 138 or later). Set rules below; the schedule search works the same.",
		};
		const shown = messages[state.availability] ? state.availability : "unavailable";
		availabilityLine.textContent = messages[shown];
		availabilityLine.dataset.state = shown;
		// Without a model the box collapses to one explanatory line instead of
		// showing a text field that can never be used.
		const noModel = shown === "unavailable" || shown === "unsupported";
		goalForm.classList.toggle("is-collapsed", noModel);
		goalLabel.hidden = noModel;
		goalInput.hidden = noModel;
		goalSubmit.hidden = noModel || shown === "downloadable" || shown === "downloading";

		downloadRow.replaceChildren();
		downloadRow.hidden = !["downloadable", "downloading"].includes(state.availability);
		if (state.availability === "downloadable") {
			downloadRow.append(
				h("p", { class: "goal-download-note" }, "Chrome downloads the model once (several GB; it needs plenty of free disk). Nothing starts until you click."),
				h("button", { type: "button", class: "btn-primary goal-download-btn", onclick: onDownload }, "download on-device model"),
			);
		} else if (state.availability === "downloading") {
			const percent = Math.round((state.downloadProgress ?? 0) * 100);
			downloadRow.append(
				h("div", { class: "goal-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(percent), "aria-label": "model download" },
					h("span", { class: "goal-progress-bar", style: `width:${percent}%` })),
				h("p", { class: "goal-download-note" }, state.downloadProgress === null ? "starting download…" : `${percent}% downloaded`),
			);
		}
		updateGoalControls();
	}

	function updateGoalControls() {
		// The goal can be written while the model downloads; it can only be
		// sent once the model is ready.
		const ready = state.availability === "available";
		goalInput.disabled = state.availability === "checking";
		goalSubmit.disabled = !ready || goalSubmit.dataset.busy === "true";
	}

	async function onDownload() {
		downloadInFlight = true;
		state.availability = "downloading";
		state.downloadProgress = null;
		renderAvailability();
		try {
			await downloadModel(languageModel, {
				onProgress(fraction) {
					state.downloadProgress = fraction;
					renderAvailability();
				},
			});
		} catch {
			setGoalStatus("The model download didn't finish. You can try again; the rules below work meanwhile.", "error");
		}
		downloadInFlight = false;
		await refreshAvailability();
		if (state.availability === "available") {
			setGoalStatus(goalInput.value.trim() ? "The model is ready. Propose rules when you're set." : "The model is ready. Describe what you want.", "info");
		}
	}

	// ---- Goal interpretation ----------------------------------------------
	function setGoalStatus(text, tone = "") {
		goalStatus.textContent = text;
		goalStatus.dataset.tone = tone;
	}

	function cancelProposal(message) {
		requests.invalidate();
		goalSubmit.dataset.busy = "false";
		goalSubmit.textContent = "propose rules";
		state.proposal = null;
		proposalArea.replaceChildren();
		if (message !== undefined) setGoalStatus(message, message ? "info" : "");
		updateGoalControls();
	}

	async function onGoalSubmit(event) {
		event.preventDefault();
		if (!state.constraints) return;
		if (state.availability !== "available") {
			setGoalStatus(state.availability === "downloading" ? "The model is still downloading. Your goal will be ready to send when it finishes." : "Download the on-device model first, or set rules below.", "info");
			return;
		}
		const goalText = goalInput.value.trim();
		if (!goalText) {
			setGoalStatus("Describe a goal first.", "error");
			goalInput.focus();
			return;
		}
		cancelProposal("");
		const ticket = requests.begin();
		const current = structuredClone(state.constraints);
		const courses = state.courses;
		goalSubmit.dataset.busy = "true";
		goalSubmit.textContent = "reading…";
		updateGoalControls();
		setGoalStatus("Reading your goal on this device…", "busy");

		try {
			const result = await interpretGoal({
				languageModel,
				goalText,
				constraints: current,
				courses,
				signal: ticket.controller.signal,
			});
			// A late answer after any cart or rule change is discarded.
			if (!requests.isCurrent(ticket)) return;
			if (!result.changes.length && !result.unresolvedGoals.length && !result.clarificationQuestions.length) {
				setGoalStatus(NON_LATIN_SCRIPT.test(goalText)
					? "No rule changes found. The on-device model reads English most reliably; try rephrasing in English."
					: "No rule changes found in that goal. Try naming days, times, credits or courses.", "info");
				return;
			}
			state.proposal = { ticket, result, current, kept: new Set(result.changes.map((change) => change.id)) };
			const languageNote = NON_LATIN_SCRIPT.test(goalText) ? " The on-device model reads English most reliably, so check each one." : "";
			setGoalStatus(result.changes.length ? `Review the proposed rules. Nothing changes until you apply them.${languageNote}` : "Nothing to change yet; see the notes below.", "info");
			renderProposal();
			countSafely("goalProposals");
		} catch (error) {
			if (!requests.owns(ticket) || error.code === "aborted") return;
			setGoalStatus(error.message || "Couldn't read that goal. Your rules are unchanged.", "error");
		} finally {
			if (requests.owns(ticket)) {
				goalSubmit.dataset.busy = "false";
				goalSubmit.textContent = "propose rules";
				updateGoalControls();
			}
		}
	}

	function describeChange(change) {
		const byId = new Map(state.courses.map((course) => [course.id, course]));
		switch (change.key) {
			case "maxCredits":
				return { label: "credit limit", from: formatCredits(change.from), to: formatCredits(change.to) };
			case "earliestMinutes":
				return { label: "no classes before", from: earliestLabel(change.from), to: earliestLabel(change.to) };
			case "unavailableDays":
				return { label: change.kind === "add" ? "day off" : "class day again", to: change.value, sign: change.kind };
			case "lockedCourseIds":
				return { label: change.kind === "add" ? "require" : "stop requiring", to: courseLabel(byId.get(change.value)), sign: change.kind };
			case "excludedCourseIds":
				return { label: change.kind === "add" ? "exclude" : "stop excluding", to: courseLabel(byId.get(change.value)), sign: change.kind };
			default:
				return { label: change.key, to: String(change.value ?? change.to) };
		}
	}

	function renderProposal() {
		const proposal = state.proposal;
		proposalArea.replaceChildren();
		if (!proposal) return;
		const { result, kept } = proposal;
		const applyButton = h("button", { type: "submit", class: "btn-primary" });
		const updateApply = () => {
			applyButton.textContent = kept.size ? `apply ${kept.size} ${kept.size === 1 ? "rule" : "rules"}` : "keep at least one rule";
			applyButton.disabled = kept.size === 0;
		};

		const rows = result.changes.map((change) => {
			const text = describeChange(change);
			const box = h("input", {
				type: "checkbox",
				checked: kept.has(change.id),
				onchange: () => {
					if (box.checked) kept.add(change.id);
					else kept.delete(change.id);
					row.classList.toggle("is-dropped", !box.checked);
					updateApply();
				},
			});
			const row = h("label", { class: "proposal-change", dataset: { key: change.key } },
				box,
				h("span", { class: "proposal-change-label" }, text.label),
				h("span", { class: "proposal-change-value" },
					text.from !== undefined ? [h("s", { class: "proposal-from" }, text.from), h("span", { class: "proposal-arrow", "aria-hidden": "true" }, "→"), " "] : null,
					text.sign ? h("span", { class: `proposal-sign proposal-sign--${text.sign}`, "aria-hidden": "true" }, text.sign === "add" ? "+" : "−") : null,
					h("strong", {}, text.to)),
			);
			return row;
		});

		const form = h("form", {
			class: "goal-proposal",
			"aria-label": "proposed rules",
			onsubmit: async (event) => {
				event.preventDefault();
				await confirmProposal();
			},
		},
			h("p", { class: "goal-proposal-eyebrow" }, "// proposed rules · not applied yet"),
			rows.length ? h("div", { class: "proposal-changes" }, rows) : null,
			renderNoteList("needs your answer", result.clarificationQuestions, "question"),
			renderNoteList("can't turn into a rule", result.unresolvedGoals, "unresolved"),
			h("p", { class: "goal-proposal-caveat" }, "Course content isn't checked: fit, prerequisites and workload aren't judged."),
			h("div", { class: "goal-proposal-actions" },
				rows.length ? applyButton : null,
				h("button", { type: "button", class: "btn-secondary", onclick: discardProposal }, rows.length ? "discard" : "dismiss")),
		);
		updateApply();
		proposalArea.append(form);
		form.querySelector("input, button")?.focus({ preventScroll: true });
	}

	function renderNoteList(title, items, tone) {
		if (!items?.length) return null;
		return h("div", { class: `goal-note goal-note--${tone}` },
			h("p", { class: "goal-note-title" }, title),
			h("ul", {}, items.map((item) => h("li", {}, item))));
	}

	async function confirmProposal() {
		const proposal = state.proposal;
		if (!proposal || !requests.isCurrent(proposal.ticket)) {
			cancelProposal("This proposal expired. Propose rules again.");
			return;
		}
		try {
			const next = applyChanges(proposal.current, proposal.result.changes, proposal.kept, state.courses);
			await saveConstraints(state.termKey, next, state.courses);
			const { unresolvedGoals, clarificationQuestions } = proposal.result;
			state.openNotes = unresolvedGoals.length || clarificationQuestions.length ? { unresolvedGoals, clarificationQuestions } : null;
			countSafely("goalConfirmed");
			cancelProposal("Rules updated. Generate schedules to see options.");
			renderOpenNotes();
			await refresh();
			rulesDetails.open = true;
			generateButton.focus({ preventScroll: true });
		} catch (error) {
			setGoalStatus(`${error.message} Adjust which rules you keep.`, "error");
		}
	}

	function discardProposal() {
		if (state.proposal?.result.changes.length) countSafely("goalDiscarded");
		cancelProposal("Proposal discarded. Your rules are unchanged.");
		goalInput.focus();
	}

	function renderOpenNotes() {
		notesArea.replaceChildren();
		if (!state.openNotes) return;
		notesArea.append(
			h("div", { class: "goal-open-notes" },
				h("div", { class: "goal-open-notes-head" },
					h("span", {}, "// still open from your goal"),
					h("button", { type: "button", class: "goal-link", onclick: () => { state.openNotes = null; renderOpenNotes(); } }, "clear")),
				renderNoteList("needs your answer", state.openNotes.clarificationQuestions, "question"),
				renderNoteList("can't turn into a rule", state.openNotes.unresolvedGoals, "unresolved")),
		);
	}

	// ---- Manual rules -----------------------------------------------------
	function showRulesMessage(text, tone = "error") {
		rulesMessage.textContent = text;
		rulesMessage.dataset.tone = tone;
		rulesMessage.hidden = !text;
		rulesMessage.setAttribute("role", tone === "error" ? "alert" : "status");
	}

	async function updateRules(patch) {
		const next = { ...state.constraints, ...patch };
		try {
			await saveConstraints(state.termKey, next, state.courses);
			showRulesMessage("");
			await refresh();
		} catch (error) {
			showRulesMessage(`${error.message} Your previous rules are kept.`);
			renderRules();
		}
	}

	function renderRules() {
		// Rules re-render after every change; keep keyboard focus on the same
		// control so a keyboard user isn't thrown back to the top of the page.
		const focused = rulesBody.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
		rulesBody.replaceChildren();
		const constraints = state.constraints;
		if (!constraints) return;
		renderRulesBody(constraints);
		if (focused) rulesBody.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
	}

	function renderRulesBody(constraints) {
		rulesSummary.textContent = summarizeRules(constraints);

		const credits = h("input", {
			id: "rule-credits",
			type: "number",
			dataset: { focusKey: "credits" },
			min: "1",
			max: "30",
			step: "0.5",
			inputmode: "decimal",
			value: String(constraints.maxCredits),
			onchange: () => {
				const value = Number(credits.value);
				updateRules({ maxCredits: value });
			},
		});

		const choices = [...new Set([...EARLIEST_CHOICES, constraints.earliestMinutes])].sort((a, b) => a - b);
		const earliest = h("select", {
			id: "rule-earliest",
			dataset: { focusKey: "earliest" },
			onchange: () => updateRules({ earliestMinutes: Number(earliest.value) }),
		}, choices.map((minutes) => h("option", { value: String(minutes), selected: minutes === constraints.earliestMinutes }, earliestLabel(minutes))));

		const usedDays = new Set(state.courses.flatMap((course) => course.components?.flatMap((part) => part.days ?? []) ?? []));
		const shownDays = DAYS.filter((day) => !["Sat", "Sun"].includes(day) || usedDays.has(day) || constraints.unavailableDays.includes(day));
		const days = h("div", { class: "rule-days", role: "group", "aria-labelledby": "rule-days-label" },
			shownDays.map((day) => {
				const off = constraints.unavailableDays.includes(day);
				return h("label", { class: `day-chip${off ? " is-off" : ""}`, title: off ? `${day}: no classes` : `${day}: classes allowed` },
					h("input", {
						type: "checkbox",
						checked: off,
						dataset: { focusKey: `day-${day}` },
						"aria-label": `No classes on ${day}`,
						onchange: (event) => {
							const set = new Set(constraints.unavailableDays);
							if (event.target.checked) set.add(day);
							else set.delete(day);
							updateRules({ unavailableDays: DAYS.filter((item) => set.has(item)) });
						},
					}),
					h("span", { "aria-hidden": "true" }, DAY_LETTERS[day]));
			}));

		const sorted = [...state.courses].sort((a, b) => normalizeCourseCode(a.courseCode).localeCompare(normalizeCourseCode(b.courseCode)) || a.section.localeCompare(b.section));
		const courseRows = sorted.map((course) => renderCourseRule(course, constraints));

		rulesBody.append(
			h("div", { class: "rule-grid" },
				h("label", { class: "rule-field", for: "rule-credits" }, h("span", { class: "rule-label" }, "credit limit"), credits),
				h("label", { class: "rule-field", for: "rule-earliest" }, h("span", { class: "rule-label" }, "no classes before"), earliest)),
			h("div", { class: "rule-field" }, h("span", { class: "rule-label", id: "rule-days-label" }, "days off"), days),
			h("div", { class: "rule-field" },
				h("span", { class: "rule-label" }, "courses"),
				h("div", { class: "rule-courses" }, courseRows)),
		);
	}

	function renderCourseRule(course, constraints) {
		const value = constraints.lockedCourseIds.includes(course.id)
			? "required"
			: constraints.excludedCourseIds.includes(course.id)
				? "excluded"
				: "consider";
		const name = `rule-course-${course.id}`;
		const segment = (option, label) =>
			h("label", { class: `segment segment--${option}` },
				h("input", {
					type: "radio",
					name,
					value: option,
					checked: value === option,
					dataset: { focusKey: `${name}-${option}` },
					onchange: () => {
						const locked = constraints.lockedCourseIds.filter((id) => id !== course.id);
						const excluded = constraints.excludedCourseIds.filter((id) => id !== course.id);
						if (option === "required") locked.push(course.id);
						if (option === "excluded") excluded.push(course.id);
						updateRules({ lockedCourseIds: locked, excludedCourseIds: excluded });
					},
				}),
				h("span", {}, label));
		const enrolled = isEnrolled(course);
		return h("div", { class: `rule-course rule-course--${value}` },
			h("div", { class: "rule-course-text" },
				h("span", { class: "rule-course-code" }, courseLabel(course), enrolled ? h("span", { class: "rule-badge" }, "enrolled") : null),
				h("span", { class: "rule-course-title" }, course.title),
				h("span", { class: "rule-course-meta" }, `${meetingSummary(course)} · ${course.credits} cr`)),
			h("div", { class: "segmented", role: "radiogroup", "aria-label": `${courseLabel(course)} rule` },
				segment("consider", enrolled ? "keep" : "maybe"),
				enrolled ? null : segment("required", "must"),
				segment("excluded", enrolled ? "drop" : "skip")),
		);
	}

	function summarizeRules(constraints) {
		const parts = [`≤ ${constraints.maxCredits} cr`];
		if (constraints.earliestMinutes) parts.push(`after ${formatMinutes(constraints.earliestMinutes)}`);
		if (constraints.unavailableDays.length) parts.push(`no ${constraints.unavailableDays.join("/")}`);
		if (constraints.lockedCourseIds.length) parts.push(`${constraints.lockedCourseIds.length} must`);
		if (constraints.excludedCourseIds.length) parts.push(`${constraints.excludedCourseIds.length} skipped`);
		return parts.join(" · ");
	}

	// ---- Schedule options -------------------------------------------------
	async function onGenerate() {
		if (!state.constraints || !state.courses.length) return;
		const courses = state.courses;
		const selectedIds = state.selection.filter((id) => courses.some((course) => course.id === id));
		const result = searchSchedules({ courses, selectedIds, constraints: state.constraints });
		state.options = {
			result,
			courses,
			selectedIds,
			fingerprint: planInputsFingerprint(courses, state.constraints),
			colors: courseColors(
				result.alternatives?.map((alternative) => alternative.courseIds.map((id) => normalizeCourseCode(courses.find((course) => course.id === id).courseCode))) ?? [],
				courses,
			),
			stale: false,
		};
		state.appliedIndex = null;
		renderOptions();
		countSafely("searchRuns");
		if (result.truncated) countSafely("searchTruncated");
		optionsAnnouncer.textContent = announceResult(result);
		revealResults(optionsArea.firstElementChild);
	}

	/**
	 * Bring new results up into view. Scrolls only the panel's own scroller:
	 * `scrollIntoView` would also scroll `overflow: hidden` ancestors and
	 * expose the settings drawer parked below the panel.
	 */
	function revealResults(target) {
		if (!target) return;
		const scroller = target.closest(".scrollable-content");
		if (!scroller) return;
		const view = scroller.getBoundingClientRect();
		const offset = target.getBoundingClientRect().top - view.top;
		if (offset >= 0 && offset < view.height * 0.4) return;
		scroller.scrollTo({
			top: scroller.scrollTop + offset - 12,
			behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
		});
	}

	function announceResult(result) {
		if (result.status === "required-failed") return "A required course can't fit. See the explanation below.";
		const count = result.alternatives.length;
		const found = count ? `${count} schedule ${count === 1 ? "option" : "options"} found.` : "No schedule options fit these rules.";
		return result.truncated ? `${found} The search stopped early, so results may be incomplete.` : found;
	}

	function renderOptions() {
		const options = state.options;
		generateButton.textContent = options ? "generate again" : "generate schedules";
		generateButton.classList.toggle("is-attention", Boolean(options?.stale));
		if (!options) {
			if (state.courses.length) {
				optionsArea.replaceChildren(h("p", { class: "options-hint" }, "Options appear here. Your planner only changes when you apply one."));
			}
			return;
		}
		const { result, courses } = options;
		const children = [];

		if (options.stale) {
			children.push(h("p", { class: "options-banner options-banner--stale", id: "options-stale-note", role: "status" }, "Your cart or rules changed since these options were made. Generate again to apply one."));
		}
		if (result.status === "required-failed") {
			const failedId = result.failure.courseId;
			const canRelax = !options.stale && state.constraints?.lockedCourseIds.includes(failedId);
			children.push(h("div", { class: "options-failure", role: "alert" },
				h("p", { class: "options-failure-title" }, "// a required course can't fit"),
				h("p", {}, describeFailure(result.failure, courses, result.constraints)),
				h("p", { class: "options-failure-hint" }, "Change that course to “maybe” or relax the rule that blocks it."),
				canRelax
					? h("div", { class: "option-actions" },
						h("button", {
							type: "button",
							class: "btn-secondary",
							onclick: async () => {
								await updateRules({ lockedCourseIds: state.constraints.lockedCourseIds.filter((id) => id !== failedId) });
								onGenerate();
							},
						}, "make it “maybe” and search again"))
					: null));
			optionsArea.replaceChildren(...children);
			return;
		}
		if (result.truncated) {
			children.push(h("p", { class: "options-banner options-banner--truncated", role: "status" }, "Search stopped early — results may be incomplete. Narrow your rules or cart for a full search."));
		}
		if (!result.alternatives.length) {
			children.push(h("div", { class: "options-empty" },
				h("p", {}, result.truncated ? "No options found before the search stopped." : "None of your cart courses fit these rules."),
				renderWhyList(explainAlternative(result, { courseIds: [], facts: { credits: 0 } }, courses, options.selectedIds), courses, true)));
			optionsArea.replaceChildren(...children);
			return;
		}
		children.push(h("p", { class: "options-order" }, sortOrderText()));
		result.alternatives.forEach((alternative, index) => children.push(renderOptionCard(alternative, index)));
		optionsArea.replaceChildren(...children);
	}

	function renderOptionCard(alternative, index) {
		const { result, courses, selectedIds, colors } = state.options;
		const byId = new Map(courses.map((course) => [course.id, course]));
		const picked = alternative.courseIds.map((id) => byId.get(id));
		const entries = explainAlternative(result, alternative, courses, selectedIds);
		const skipped = entries.filter((entry) => entry.status === "skipped").length;
		const unknown = entries.filter((entry) => entry.status === "unknown").length;
		const applied = state.appliedIndex === index;
		const disabled = state.options.stale || applied;
		const diff = index > 0 ? diffAlternatives(result.alternatives[0], alternative) : null;
		const added = new Set(diff?.added ?? []);
		const colorOf = (course) => colors.get(normalizeCourseCode(course.courseCode));
		const name = OPTION_NAMES[index];
		const headingId = `option-${name}-title`;

		return h("article", { class: `option-card${applied ? " is-applied" : ""}`, "aria-labelledby": headingId },
			h("header", { class: "option-head" },
				h("h3", { class: "option-name", id: headingId }, `option ${name}`),
				applied ? h("span", { class: "option-applied-badge" }, "in your planner") : null),
			h("p", { class: "option-facts" }, summarizeFacts(alternative.facts).map((fact) => h("span", { class: "option-fact" }, fact))),
			diff ? renderDiff(diff, byId) : null,
			renderWeekStrip(picked, colorOf),
			h("ul", { class: "option-courses", "aria-label": `Courses in option ${name}` },
				picked.map((course) => h("li", { class: `option-course${added.has(course.id) ? " is-diff" : ""}`, style: `--c:${colorOf(course)}` },
					h("span", { class: "option-course-code" }, courseLabel(course)),
					h("span", { class: "option-course-title", title: course.title }, course.title),
					h("span", { class: "option-course-credits" }, `${course.credits} cr`)))),
			h("details", { class: "option-why" },
				h("summary", {}, h("span", {}, "why"), " ", h("span", { class: "option-why-counts" }, `${picked.length} in${skipped ? ` · ${skipped} out` : ""}${unknown ? ` · ${unknown} unknown` : ""}`)),
				renderWhyList(entries, courses)),
			h("div", { class: "option-actions" },
				h("button", {
					type: "button",
					class: index === 0 && !applied ? "btn-primary" : "btn-secondary",
					disabled,
					"aria-describedby": state.options.stale ? "options-stale-note" : null,
					onclick: () => applyOption(index),
				}, applied ? "✓ applied to planner" : `apply option ${name}`)),
		);
	}

	function renderDiff({ added, removed }, byId) {
		if (!added.length && !removed.length) return null;
		const codeOf = (id) => normalizeCourseCode(byId.get(id)?.courseCode);
		// A different section of the same course reads as a swap, not as one
		// course added and another dropped.
		const swaps = [];
		const remaining = [...removed];
		const adds = added.filter((id) => {
			const match = remaining.findIndex((other) => codeOf(other) === codeOf(id));
			if (match < 0) return true;
			swaps.push([remaining[match], id]);
			remaining.splice(match, 1);
			return false;
		});
		const item = (id, sign) => h("span", { class: `option-diff-item option-diff-item--${sign}` },
			h("span", { class: "option-diff-sign", "aria-hidden": "true" }, sign === "add" ? "+" : "−"),
			h("span", { class: "visually-hidden" }, sign === "add" ? "adds " : "drops "),
			courseLabel(byId.get(id)));
		const swap = ([from, to]) => h("span", { class: "option-diff-item option-diff-item--swap" },
			`${byId.get(from).courseCode} · ${byId.get(from).section}`,
			h("span", { class: "option-diff-sign option-diff-sign--swap", "aria-hidden": "true" }, " → "),
			h("span", { class: "visually-hidden" }, " switches to section "),
			byId.get(to).section);
		return h("p", { class: "option-diff" },
			h("span", { class: "option-diff-label" }, "vs A"),
			swaps.map(swap),
			adds.map((id) => item(id, "add")),
			remaining.map((id) => item(id, "remove")));
	}

	function renderWhyList(entries, courses, onlyProblems = false) {
		const byId = new Map(courses.map((course) => [course.id, course]));
		const order = { included: 0, unknown: 1, skipped: 2 };
		const labels = { included: "in", unknown: "?", skipped: "out" };
		const spoken = { included: "included", unknown: "unknown", skipped: "left out" };
		const shown = entries
			.filter((entry) => !onlyProblems || entry.status !== "included")
			.sort((a, b) => order[a.status] - order[b.status]);
		// role attributes keep list semantics under `display: contents`.
		return h("ul", { class: "why-list", role: "list" },
			shown.map((entry) => h("li", { class: `why-item why-item--${entry.status}`, role: "listitem" },
				h("span", { class: "why-status", "aria-label": spoken[entry.status] }, labels[entry.status]),
				h("span", { class: "why-course" }, courseLabel(byId.get(entry.courseId))),
				h("span", { class: "why-reason" }, entry.reason))));
	}

	/** Hour range that frames these meetings, at least STRIP_MIN_HOURS tall. */
	function stripRange(meetings) {
		if (!meetings.length) return { start: 9 * 60, end: 17 * 60 };
		let start = Math.min(...meetings.map(({ part }) => toMinutes(part.timeRange.start)));
		let end = Math.max(...meetings.map(({ part }) => toMinutes(part.timeRange.end)));
		start = Math.floor(start / 60) * 60;
		end = Math.ceil(end / 60) * 60;
		const missing = STRIP_MIN_HOURS * 60 - (end - start);
		if (missing > 0) {
			start = Math.max(0, start - Math.floor(missing / 120) * 60);
			end = Math.min(24 * 60, start + STRIP_MIN_HOURS * 60);
		}
		return { start, end };
	}

	function hourLabel(minutes) {
		const hours = Math.floor(minutes / 60) % 24;
		const suffix = hours < 12 ? "a" : "p";
		return `${hours % 12 || 12}${suffix}`;
	}

	function renderWeekStrip(picked, colorOf) {
		const meetings = picked.flatMap((course) =>
			(course.components ?? [])
				.filter((part) => part.timeRange && part.days?.length)
				.map((part) => ({ part, course })));
		const weekend = meetings.some(({ part }) => part.days.some((day) => day === "Sat" || day === "Sun"));
		const days = weekend ? DAYS : DAYS.slice(0, 5);
		const range = stripRange(meetings);
		const span = range.end - range.start;
		const hours = span / 60;
		// One label at the top of each hour row (every other row on long days).
		const ticks = [];
		const step = hours > 8 ? 2 : 1;
		for (let minutes = range.start; minutes < range.end; minutes += step * 60) ticks.push(minutes);
		const at = (minutes) => `${((minutes - range.start) / span) * 100}%`;

		return h("div", { class: "week-strip", style: `--cols:${days.length};--hours:${hours}`, "aria-hidden": "true" },
			h("div", { class: "week-axis" },
				h("span", { class: "week-day" }, ""),
				h("div", { class: "week-axis-track" },
					ticks.map((minutes) => h("span", { class: "week-tick", style: `top:${at(minutes)}` }, hourLabel(minutes))))),
			days.map((day) => h("div", { class: "week-col" },
				h("span", { class: "week-day" }, DAY_LETTERS[day]),
				h("div", { class: "week-track" },
					meetings
						.filter(({ part }) => part.days.includes(day))
						.map(({ part, course }) => {
							const start = toMinutes(part.timeRange.start);
							const end = toMinutes(part.timeRange.end);
							return h("span", {
								class: "week-block",
								title: `${courseLabel(course)} · ${formatMinutes(start)}–${formatMinutes(end)}`,
								style: `top:${at(start)};height:max(3px, ${((end - start) / span) * 100}%);--c:${colorOf(course)}`,
							});
						})))));
	}

	async function applyOption(index) {
		const options = state.options;
		if (!options) return;
		// Recheck freshness against storage, not just the in-memory copy.
		const courses = await getCourses();
		const { constraints } = await loadConstraints(state.termKey, courses);
		if (resolveTermKey(courses) === null || planInputsFingerprint(courses, constraints) !== options.fingerprint) {
			options.stale = true;
			renderOptions();
			return;
		}
		const chosen = options.result.alternatives[index].courseIds;
		const termIds = new Set(courses.map((course) => course.id));
		const selection = await getPlannerSelection();
		await setPlannerSelection([...selection.filter((id) => !termIds.has(id)), ...chosen]);
		state.appliedIndex = index;
		renderOptions();
		optionsArea.querySelectorAll(".option-card")[index]?.querySelector(".option-actions button")?.focus({ preventScroll: true });
	}

	function countSafely(name) {
		incrementCounter(name).catch((error) => console.warn("[Albert Enhancer] counter failed:", error));
	}

	return { refresh };
}
