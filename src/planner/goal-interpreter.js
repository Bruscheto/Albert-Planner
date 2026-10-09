// On-device goal interpretation through Chrome's built-in Prompt API.
//
// The model only proposes a constraint patch. Its output is validated with the
// same contract as the hosted prototype, and nothing is applied here: the
// caller shows the proposal as a diff and applies it after confirmation.

import { DAYS, validateConstraints } from "../shared/constraints.js";
import {
	buildInterpretationSchema,
	interpretationInstructions,
	validateInterpretation,
} from "../shared/ai-contract.js";

export const INTERPRET_TIMEOUT_MS = 10_000;
export const MAX_GOAL_LENGTH = 2000;

const MODEL_OPTIONS = Object.freeze({
	expectedInputs: [{ type: "text", languages: ["en"] }],
	expectedOutputs: [{ type: "text", languages: ["en"] }],
});

/**
 * @typedef {"unsupported"|"unavailable"|"downloadable"|"downloading"|"available"} ModelAvailability
 * `unsupported` means this browser has no Prompt API at all.
 */

/**
 * @typedef {Object} Proposal
 * @property {import("./search.js").Constraints} proposedConstraints
 * @property {string[]} unresolvedGoals
 * @property {string[]} clarificationQuestions
 * @property {ConstraintChange[]} changes
 */

/**
 * One atomic change between the current and proposed constraints, so the
 * student can keep or drop each one.
 * @typedef {Object} ConstraintChange
 * @property {string} id
 * @property {"maxCredits"|"earliestMinutes"|"unavailableDays"|"lockedCourseIds"|"excludedCourseIds"} key
 * @property {"set"|"add"|"remove"} kind
 * @property {*} [from]
 * @property {*} [to]
 * @property {string} [value]
 */

export class InterpretError extends Error {
	/**
	 * @param {"timeout"|"invalid"|"unavailable"|"aborted"|"failed"} code
	 * @param {string} message
	 */
	constructor(code, message) {
		super(message);
		this.name = "InterpretError";
		this.code = code;
	}
}

/** The Prompt API entry point, if this browser has one. */
export function getLanguageModel(scope = globalThis) {
	const model = scope?.LanguageModel;
	return model && typeof model.availability === "function" ? model : null;
}

/**
 * @param {object | null} languageModel
 * @returns {Promise<ModelAvailability>}
 */
export async function checkAvailability(languageModel) {
	if (!languageModel) return "unsupported";
	try {
		const state = await languageModel.availability(MODEL_OPTIONS);
		return ["unavailable", "downloadable", "downloading", "available"].includes(
			state,
		)
			? state
			: "unavailable";
	} catch {
		return "unavailable";
	}
}

/**
 * Start (or resume) the on-device model download. Must be called from a user
 * action; the browser requires it and so does the spec.
 *
 * @param {object} languageModel
 * @param {{ onProgress?: (fraction: number) => void, signal?: AbortSignal }} [options]
 */
export async function downloadModel(languageModel, { onProgress, signal } = {}) {
	const session = await languageModel.create({
		...MODEL_OPTIONS,
		signal,
		monitor(monitor) {
			monitor.addEventListener("downloadprogress", (event) => {
				onProgress?.(Number(event.loaded) || 0);
			});
		},
	});
	session.destroy?.();
}

const EXAMPLE_INPUT = {
	goalText: "No Friday classes and I want to finish by 4. Keep CSCI-UA 201.",
	currentConstraints: {
		maxCredits: 18,
		earliestMinutes: 0,
		unavailableDays: [],
		lockedCourseIds: [],
		excludedCourseIds: [],
	},
	courses: [
		{ id: "ex-1", courseCode: "CSCI-UA 201", title: "Computer Systems Org", section: "001" },
		{ id: "ex-2", courseCode: "MATH-UA 121", title: "Calculus I", section: "002" },
	],
};

const EXAMPLE_OUTPUT = {
	constraintPatch: {
		maxCredits: null,
		earliestMinutes: null,
		unavailableDays: ["Fri"],
		lockedCourseIds: ["ex-1"],
		excludedCourseIds: null,
	},
	unresolvedGoals: [
		"Finishing by 4 PM is not a supported rule yet; only an earliest start time can be set.",
	],
	clarificationQuestions: [],
};

/** Course fields the model may see. Meeting times and anything else stay local. */
export function toModelCourses(courses) {
	return courses.map(({ id, courseCode, title, section }) => ({
		id,
		courseCode,
		title,
		section,
	}));
}

function withTimeout(signal, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(new InterpretError("timeout", "timeout")),
		timeoutMs,
	);
	const relay = () => controller.abort(signal.reason);
	if (signal) {
		if (signal.aborted) relay();
		else signal.addEventListener("abort", relay, { once: true });
	}
	return {
		signal: controller.signal,
		timedOut: () => controller.signal.reason instanceof InterpretError,
		dispose() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", relay);
		},
	};
}

function initialPrompts() {
	return [
		{
			role: "system",
			content: `${interpretationInstructions}\nDays are written ${DAYS.join(", ")}. Return only JSON that matches the schema.`,
		},
		{ role: "user", content: JSON.stringify(EXAMPLE_INPUT) },
		{ role: "assistant", content: JSON.stringify(EXAMPLE_OUTPUT) },
	];
}

// The instructions and example are the same for every goal, so one primed
// session is kept and cloned per request; each clone starts from the same
// context and nothing from one goal carries into the next.
const baseSessions = new WeakMap();
const withoutClone = new WeakSet();

function freshSession(languageModel, signal) {
	return languageModel.create({ ...MODEL_OPTIONS, signal, initialPrompts: initialPrompts() });
}

async function createSession(languageModel, signal) {
	if (withoutClone.has(languageModel)) return freshSession(languageModel, signal);
	let base = baseSessions.get(languageModel);
	if (!base) {
		const created = Promise.resolve().then(() =>
			languageModel.create({ ...MODEL_OPTIONS, initialPrompts: initialPrompts() }),
		);
		base = created;
		baseSessions.set(languageModel, created);
		created.then(
			// A session that arrives after it was given up on is released.
			(session) => {
				if (baseSessions.get(languageModel) !== created) session?.destroy?.();
			},
			() => {
				if (baseSessions.get(languageModel) === created) baseSessions.delete(languageModel);
			},
		);
	}
	let primed;
	try {
		primed = await abortable(base, signal);
	} catch (error) {
		// A cancelled request leaves the shared session loading for the next
		// one; a timeout or failure starts over next time.
		const cancelled = signal.aborted && !(signal.reason instanceof InterpretError);
		if (!cancelled && baseSessions.get(languageModel) === base) baseSessions.delete(languageModel);
		throw error;
	}
	if (typeof primed.clone !== "function") {
		// No clone support: a fresh session per request, never a shared one.
		withoutClone.add(languageModel);
		baseSessions.delete(languageModel);
		primed.destroy?.();
		return freshSession(languageModel, signal);
	}
	try {
		return await primed.clone({ signal });
	} catch (error) {
		if (!signal.aborted) {
			baseSessions.delete(languageModel);
			primed.destroy?.();
		}
		throw error;
	}
}

/** Reject when `signal` aborts, without cancelling the shared work. */
function abortable(promise, signal) {
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(signal.reason);
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener("abort", onAbort);
				reject(error);
			},
		);
	});
}

/**
 * Interpret a plain-language goal into a validated proposal. Never applies it.
 *
 * @param {Object} input
 * @param {object} input.languageModel - `LanguageModel` or a test double.
 * @param {string} input.goalText
 * @param {import("./search.js").Constraints} input.constraints - Current, validated.
 * @param {object[]} input.courses - Courses the constraints refer to.
 * @param {AbortSignal} [input.signal]
 * @param {number} [input.timeoutMs]
 * @returns {Promise<Proposal>}
 */
export async function interpretGoal({
	languageModel,
	goalText,
	constraints,
	courses,
	signal,
	timeoutMs = INTERPRET_TIMEOUT_MS,
}) {
	const text = typeof goalText === "string" ? goalText.trim() : "";
	if (!text || text.length > MAX_GOAL_LENGTH) {
		throw new InterpretError(
			"invalid",
			`Describe your goal in 1–${MAX_GOAL_LENGTH.toLocaleString("en-US")} characters.`,
		);
	}
	if (!languageModel) {
		throw new InterpretError(
			"unavailable",
			"On-device AI isn't available in this browser.",
		);
	}
	const current = validateConstraints(constraints, courses);
	const modelCourses = toModelCourses(courses);
	const schema = buildInterpretationSchema(modelCourses.map((course) => course.id));
	const deadline = withTimeout(signal, timeoutMs);
	let session;
	let raw;

	try {
		session = await createSession(languageModel, deadline.signal);
		raw = await session.prompt(
			JSON.stringify({
				goalText: text,
				currentConstraints: current,
				courses: modelCourses,
			}),
			{ responseConstraint: schema, signal: deadline.signal },
		);
	} catch (error) {
		if (deadline.timedOut()) {
			throw new InterpretError(
				"timeout",
				"The on-device model took longer than 10 seconds. Your rules are unchanged.",
			);
		}
		if (signal?.aborted || error?.name === "AbortError") {
			throw new InterpretError("aborted", "Interpretation was cancelled.");
		}
		throw new InterpretError(
			"failed",
			"The on-device model couldn't interpret that goal. Your rules are unchanged.",
		);
	} finally {
		deadline.dispose();
		session?.destroy?.();
	}

	// Schema-shaped output is still untrusted output.
	let parsed;
	try {
		parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
	} catch {
		throw invalidOutput();
	}
	let result;
	try {
		result = validateInterpretation(tidyModelOutput(parsed), current, courses);
	} catch {
		throw invalidOutput();
	}
	return {
		...result,
		changes: diffConstraints(current, result.proposedConstraints),
	};
}

// Small models sometimes pad note lists with empty strings or repeat a list
// value ("Fri", "Fri"). Neither changes the meaning, so they are cleaned up
// instead of failing the whole proposal. Everything else is validated as is.
function tidyModelOutput(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const clean = { ...value };
	for (const key of ["unresolvedGoals", "clarificationQuestions"]) {
		if (Array.isArray(clean[key])) {
			clean[key] = clean[key].filter(
				(item) => typeof item !== "string" || item.trim(),
			);
		}
	}
	const patch = clean.constraintPatch;
	if (patch && typeof patch === "object" && !Array.isArray(patch)) {
		clean.constraintPatch = { ...patch };
		for (const key of ["unavailableDays", "lockedCourseIds", "excludedCourseIds"]) {
			if (Array.isArray(patch[key])) clean.constraintPatch[key] = [...new Set(patch[key])];
		}
	}
	return clean;
}

function invalidOutput() {
	return new InterpretError(
		"invalid",
		"The model's answer didn't match the rules format, so it was discarded. Your rules are unchanged.",
	);
}

const LIST_KEYS = ["unavailableDays", "lockedCourseIds", "excludedCourseIds"];

/**
 * @param {import("./search.js").Constraints} current
 * @param {import("./search.js").Constraints} proposed
 * @returns {ConstraintChange[]}
 */
export function diffConstraints(current, proposed) {
	const changes = [];
	for (const key of ["maxCredits", "earliestMinutes"]) {
		if (current[key] !== proposed[key]) {
			changes.push({ id: key, key, kind: "set", from: current[key], to: proposed[key] });
		}
	}
	for (const key of LIST_KEYS) {
		for (const value of proposed[key]) {
			if (!current[key].includes(value)) {
				changes.push({ id: `${key}:+${value}`, key, kind: "add", value });
			}
		}
		for (const value of current[key]) {
			if (!proposed[key].includes(value)) {
				changes.push({ id: `${key}:-${value}`, key, kind: "remove", value });
			}
		}
	}
	const dayOrder = (value) => DAYS.indexOf(value);
	return changes.sort((a, b) => {
		const keyOrder =
			["maxCredits", "earliestMinutes", ...LIST_KEYS].indexOf(a.key) -
			["maxCredits", "earliestMinutes", ...LIST_KEYS].indexOf(b.key);
		if (keyOrder) return keyOrder;
		if (a.key === "unavailableDays") return dayOrder(a.value) - dayOrder(b.value);
		return 0;
	});
}

/**
 * Apply the changes the student kept. Throws the contract's validation error
 * if the kept set is contradictory (for example, required and excluded).
 *
 * @param {import("./search.js").Constraints} current
 * @param {ConstraintChange[]} changes
 * @param {Set<string>} keptIds
 * @param {object[]} courses
 */
export function applyChanges(current, changes, keptIds, courses) {
	const next = structuredClone(current);
	for (const change of changes) {
		if (!keptIds.has(change.id)) continue;
		if (change.kind === "set") next[change.key] = change.to;
		else if (change.kind === "add") {
			if (!next[change.key].includes(change.value)) next[change.key].push(change.value);
		} else {
			next[change.key] = next[change.key].filter((value) => value !== change.value);
		}
	}
	next.unavailableDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
	return validateConstraints(next, courses);
}
