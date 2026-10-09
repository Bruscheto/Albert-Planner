// Goal-planning state in chrome.storage.local: constraints per term and
// local-only usage counters. Both keys are additive; older data is untouched.

import { STORAGE_KEYS } from "../shared/constants.js";
import {
	defaultConstraints,
	validateConstraints,
} from "../shared/constraints.js";

export const DEFAULT_TERM_KEY = "default";

/** Counters shown in Settings. They never leave the device on their own. */
export const COUNTER_NAMES = Object.freeze([
	"goalProposals",
	"goalConfirmed",
	"goalDiscarded",
	"searchRuns",
	"searchTruncated",
]);

/**
 * Extension defaults: no earliest-start rule, and 18 credits, the usual
 * full-time ceiling before overload approval.
 * @returns {import("../planner/search.js").Constraints}
 */
export function extensionDefaultConstraints() {
	return { ...defaultConstraints(), maxCredits: 18, earliestMinutes: 0 };
}

/**
 * The single term these courses belong to, or null when they span several.
 * @param {object[]} courses
 * @param {{ name?: string } | null} activeTerm
 * @returns {string | null}
 */
export function resolveTermKey(courses, activeTerm = null) {
	const names = [
		...new Set(
			courses
				.map((course) => course?.term?.name)
				.filter((name) => typeof name === "string" && name.trim())
				.map((name) => name.trim()),
		),
	];
	if (names.length > 1) return null;
	if (names.length === 1) return names[0];
	const active = activeTerm?.name;
	return typeof active === "string" && active.trim()
		? active.trim()
		: DEFAULT_TERM_KEY;
}

async function readMap(key) {
	const result = await chrome.storage.local.get(key);
	const value = result[key];
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

/**
 * Load the saved constraints for a term, revalidated against the current
 * courses. Rules that point at courses no longer in the cart are dropped and
 * reported; anything else invalid falls back to defaults.
 *
 * @returns {Promise<{ constraints: import("../planner/search.js").Constraints, droppedIds: string[] }>}
 */
export async function loadConstraints(termKey, courses) {
	const stored = (await readMap(STORAGE_KEYS.GOAL_CONSTRAINTS))[termKey];
	if (!stored || typeof stored !== "object") {
		return { constraints: extensionDefaultConstraints(), droppedIds: [] };
	}
	const ids = new Set(courses.map((course) => course.id));
	const droppedIds = [];
	const keep = (list) =>
		Array.isArray(list)
			? list.filter((id) => {
					if (ids.has(id)) return true;
					droppedIds.push(id);
					return false;
				})
			: list;
	try {
		const constraints = validateConstraints(
			{
				...extensionDefaultConstraints(),
				...pickKnown(stored),
				lockedCourseIds: keep(stored.lockedCourseIds ?? []),
				excludedCourseIds: keep(stored.excludedCourseIds ?? []),
			},
			courses,
		);
		return { constraints, droppedIds };
	} catch {
		return { constraints: extensionDefaultConstraints(), droppedIds: [] };
	}
}

function pickKnown(value) {
	const known = Object.keys(extensionDefaultConstraints());
	return Object.fromEntries(
		Object.entries(value).filter(([key]) => known.includes(key)),
	);
}

/**
 * Validate and save constraints for one term. Other terms are kept.
 * Throws the contract's message when the constraints are invalid, so the
 * caller can keep the previous rules and show why.
 */
export async function saveConstraints(termKey, constraints, courses) {
	const validated = validateConstraints(constraints, courses);
	const map = await readMap(STORAGE_KEYS.GOAL_CONSTRAINTS);
	await chrome.storage.local.set({
		[STORAGE_KEYS.GOAL_CONSTRAINTS]: { ...map, [termKey]: validated },
	});
	return validated;
}

export async function getCounters() {
	const stored = await readMap(STORAGE_KEYS.LOCAL_COUNTERS);
	return Object.fromEntries(
		COUNTER_NAMES.map((name) => [
			name,
			Number.isSafeInteger(stored[name]) && stored[name] > 0 ? stored[name] : 0,
		]),
	);
}

export async function incrementCounter(name) {
	if (!COUNTER_NAMES.includes(name)) throw new Error(`Unknown counter: ${name}`);
	const counters = await getCounters();
	counters[name] += 1;
	await chrome.storage.local.set({ [STORAGE_KEYS.LOCAL_COUNTERS]: counters });
	return counters;
}

export async function resetCounters() {
	await chrome.storage.local.set({
		[STORAGE_KEYS.LOCAL_COUNTERS]: Object.fromEntries(
			COUNTER_NAMES.map((name) => [name, 0]),
		),
	});
}
