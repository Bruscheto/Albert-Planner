// Bounded, complete schedule search over section choices.
//
// Each course code is one variable whose values are its eligible sections plus
// "not taken". Required sections and enrolled courses are fixed. The search is
// a depth-first branch and bound that keeps the top alternatives under a fixed
// lexicographic order and stops after NODE_LIMIT explored nodes.

import { DAYS, validateConstraints } from "../shared/constraints.js";
import { doTimesOverlap, timeToMinutes } from "../shared/time-parser.js";

export const NODE_LIMIT = 50000;
export const MAX_ALTERNATIVES = 3;

/**
 * The fixed ranking, most significant first. Shown to the student verbatim.
 * @type {ReadonlyArray<{ key: string, label: string }>}
 */
export const SORT_ORDER = Object.freeze([
	{ key: "selectedCount", label: "more courses from your planner" },
	{ key: "credits", label: "credits closest to your limit" },
	{ key: "dayCount", label: "fewer class days" },
	{ key: "earliestStart", label: "later first class" },
	{ key: "pinnedCount", label: "keeping the sections you picked" },
]);

/**
 * @typedef {Object} TimeOfDay
 * @property {number} hours
 * @property {number} minutes
 */

/**
 * @typedef {Object} CourseComponent
 * @property {string} type
 * @property {string[]} days
 * @property {{ start: TimeOfDay, end: TimeOfDay } | null} timeRange
 * @property {boolean} [isTBA]
 */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} courseCode
 * @property {string} section
 * @property {string} title
 * @property {number} credits
 * @property {CourseComponent[]} components
 * @property {string} [status]
 */

/**
 * @typedef {Object} Constraints
 * @property {number} maxCredits
 * @property {number} earliestMinutes
 * @property {string[]} unavailableDays
 * @property {string[]} lockedCourseIds
 * @property {string[]} excludedCourseIds
 */

/**
 * Why a section can never be chosen under the current constraints.
 * @typedef {Object} StaticBlock
 * @property {"excluded"|"unconfirmed"|"beforeEarliest"|"unavailableDay"|"selfOverlap"|"overCredits"|"overlapsFixed"|"sameCourseFixed"} code
 * @property {string[]} [days]
 * @property {number} [startMinutes]
 * @property {string} [otherId]
 * @property {number} [fixedCredits] - For overCredits caused by required and enrolled courses.
 */

/**
 * @typedef {Object} Alternative
 * @property {string[]} courseIds - Chosen section IDs in cart order, fixed courses included.
 * @property {{ selectedCount: number, credits: number, dayCount: number, earliestStart: number | null, latestEnd: number | null, days: string[], courseCount: number }} facts
 */

/**
 * @typedef {Object} SearchResult
 * @property {"ok"|"required-failed"} status
 * @property {Alternative[]} alternatives
 * @property {boolean} truncated
 * @property {number} nodesExplored
 * @property {{ courseId: string, code: string, otherId?: string, days?: string[], startMinutes?: number, credits?: number }} [failure]
 * @property {Map<string, StaticBlock>} blocked - Sections that can never be chosen, with the reason.
 * @property {Set<string>} fixedIds - Required and enrolled sections.
 * @property {Constraints} constraints
 */

export function normalizeCourseCode(code) {
	return String(code ?? "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();
}

/** A section whose meeting times are not fully known cannot be placed. */
export function hasUnconfirmedMeetings(course) {
	const parts = course.components ?? [];
	return (
		parts.length === 0 ||
		parts.some(
			(part) => part.isTBA || !part.timeRange || !part.days?.length,
		)
	);
}

export function isEnrolled(course) {
	return /^enrolled$/i.test(String(course.status ?? "").trim());
}

function timedMeetings(course) {
	return (course.components ?? []).filter(
		(part) => part.timeRange && part.days?.length,
	);
}

function meetingsOverlap(a, b) {
	return (
		a.days.some((day) => b.days.includes(day)) &&
		doTimesOverlap(a.timeRange, b.timeRange)
	);
}

function sectionsOverlap(a, b) {
	return a.meetings.some((left) =>
		b.meetings.some((right) => meetingsOverlap(left, right)),
	);
}

function dayMask(meetings) {
	let mask = 0;
	for (const meeting of meetings) {
		for (const day of meeting.days) {
			const index = DAYS.indexOf(day);
			if (index >= 0) mask |= 1 << index;
		}
	}
	return mask;
}

function countBits(mask) {
	let count = 0;
	for (let value = mask; value; value &= value - 1) count += 1;
	return count;
}

function earliestOf(meetings) {
	let earliest = null;
	for (const meeting of meetings) {
		const start = timeToMinutes(meeting.timeRange.start);
		if (earliest === null || start < earliest) earliest = start;
	}
	return earliest;
}

function latestOf(meetings) {
	let latest = null;
	for (const meeting of meetings) {
		const end = timeToMinutes(meeting.timeRange.end);
		if (latest === null || end > latest) latest = end;
	}
	return latest;
}

const CREDIT_EPSILON = 1e-9;

/**
 * Compare two score vectors. Positive when `a` ranks ahead of `b`.
 * A missing earliest start (no timed meetings) ranks as late as possible.
 */
export function compareScores(a, b) {
	if (a.selectedCount !== b.selectedCount) {
		return a.selectedCount - b.selectedCount;
	}
	if (Math.abs(a.credits - b.credits) > CREDIT_EPSILON) {
		return a.credits - b.credits;
	}
	if (a.dayCount !== b.dayCount) return b.dayCount - a.dayCount;
	const startA = a.earliestStart ?? 24 * 60;
	const startB = b.earliestStart ?? 24 * 60;
	if (startA !== startB) return startA - startB;
	return a.pinnedCount - b.pinnedCount;
}

function staticBlock(section, constraints) {
	const { course } = section;
	if (constraints.excludedCourseIds.includes(course.id)) {
		return { code: "excluded" };
	}
	if (section.unconfirmed) return { code: "unconfirmed" };
	const early = section.meetings.find(
		(meeting) =>
			timeToMinutes(meeting.timeRange.start) < constraints.earliestMinutes,
	);
	if (early) {
		return {
			code: "beforeEarliest",
			startMinutes: timeToMinutes(early.timeRange.start),
		};
	}
	const blockedDays = DAYS.filter(
		(day) =>
			constraints.unavailableDays.includes(day) &&
			section.meetings.some((meeting) => meeting.days.includes(day)),
	);
	if (blockedDays.length) return { code: "unavailableDay", days: blockedDays };
	for (let i = 0; i < section.meetings.length; i += 1) {
		for (let j = i + 1; j < section.meetings.length; j += 1) {
			if (meetingsOverlap(section.meetings[i], section.meetings[j])) {
				return { code: "selfOverlap" };
			}
		}
	}
	if (course.credits > constraints.maxCredits + CREDIT_EPSILON) {
		return { code: "overCredits" };
	}
	return null;
}

function toSection(course, index, selectedIds, selectedCodes) {
	const meetings = timedMeetings(course);
	const code = normalizeCourseCode(course.courseCode);
	return {
		course,
		index,
		code,
		credits: Number.isFinite(course.credits) ? course.credits : 0,
		meetings,
		mask: dayMask(meetings),
		earliest: earliestOf(meetings),
		latest: latestOf(meetings),
		// A planner pick expresses interest in the course; any of its sections
		// satisfies it, which is what lets search swap a blocking section.
		selected: selectedCodes.has(code),
		pinned: selectedIds.has(course.id),
		unconfirmed: hasUnconfirmedMeetings(course),
	};
}

class RequiredFailure extends Error {
	constructor(failure) {
		super("Required course cannot fit");
		this.failure = failure;
	}
}

function resolveFixed(sections, constraints) {
	const locked = new Set(constraints.lockedCourseIds);
	const fixed = [];

	for (const section of sections) {
		const isLocked = locked.has(section.course.id);
		const enrolled =
			isEnrolled(section.course) &&
			!constraints.excludedCourseIds.includes(section.course.id);
		if (!isLocked && !enrolled) continue;
		if (isLocked) {
			const block = staticBlock(section, constraints);
			if (block) {
				throw new RequiredFailure({
					courseId: section.course.id,
					...block,
				});
			}
		}
		section.fixedReason = isLocked ? "required" : "enrolled";
		fixed.push(section);
	}

	// Enrolled courses are commitments that already exist; required sections
	// must fit around them and around each other.
	for (let i = 0; i < fixed.length; i += 1) {
		for (let j = i + 1; j < fixed.length; j += 1) {
			const a = fixed[i];
			const b = fixed[j];
			if (a.fixedReason === "enrolled" && b.fixedReason === "enrolled") {
				continue;
			}
			const [required, other] =
				a.fixedReason === "required" ? [a, b] : [b, a];
			if (a.code === b.code) {
				throw new RequiredFailure({
					courseId: required.course.id,
					code: "sameCourseFixed",
					otherId: other.course.id,
				});
			}
			if (sectionsOverlap(a, b)) {
				throw new RequiredFailure({
					courseId: required.course.id,
					code: "overlapsFixed",
					otherId: other.course.id,
				});
			}
		}
	}

	const fixedCredits = fixed.reduce((sum, item) => sum + item.credits, 0);
	const lockedSections = fixed.filter((item) => item.fixedReason === "required");
	if (
		lockedSections.length &&
		fixedCredits > constraints.maxCredits + CREDIT_EPSILON
	) {
		throw new RequiredFailure({
			courseId: lockedSections[lockedSections.length - 1].course.id,
			code: "overCredits",
			credits: fixedCredits,
		});
	}

	return { fixed, fixedCredits };
}

/**
 * Search for up to MAX_ALTERNATIVES ranked schedules.
 *
 * @param {Object} input
 * @param {Course[]} input.courses - Cart and enrolled sections for one term.
 * @param {string[]} [input.selectedIds] - Planner selection. Courses with a
 *   planner pick rank first; any of their sections counts.
 * @param {Constraints} input.constraints - Validated against `courses`.
 * @param {number} [input.nodeLimit]
 * @param {number} [input.maxAlternatives]
 * @returns {SearchResult}
 */
export function searchSchedules({
	courses,
	selectedIds = [],
	constraints: rawConstraints,
	nodeLimit = NODE_LIMIT,
	maxAlternatives = MAX_ALTERNATIVES,
}) {
	const constraints = validateConstraints(rawConstraints, courses);
	const selected = new Set(selectedIds);
	const selectedCodes = new Set(
		courses
			.filter((course) => selected.has(course.id))
			.map((course) => normalizeCourseCode(course.courseCode)),
	);
	const sections = courses.map((course, index) =>
		toSection(course, index, selected, selectedCodes),
	);

	let resolved;
	try {
		resolved = resolveFixed(sections, constraints);
	} catch (error) {
		if (!(error instanceof RequiredFailure)) throw error;
		return {
			status: "required-failed",
			failure: error.failure,
			alternatives: [],
			truncated: false,
			nodesExplored: 0,
			blocked: new Map(),
			fixedIds: new Set(),
			constraints,
		};
	}

	const { fixed, fixedCredits } = resolved;
	const blocked = new Map();
	const fixedIds = new Set(fixed.map((item) => item.course.id));
	const fixedCodes = new Set(fixed.map((item) => item.code));
	const budget = constraints.maxCredits - fixedCredits;

	// Group the remaining sections by course code, dropping any that can
	// never be chosen and recording why.
	const groupsByCode = new Map();
	for (const section of sections) {
		if (fixedIds.has(section.course.id)) continue;
		let block = staticBlock(section, constraints);
		if (!block && fixedCodes.has(section.code)) {
			const other = fixed.find((item) => item.code === section.code);
			block = { code: "sameCourseFixed", otherId: other.course.id };
		}
		if (!block) {
			const other = fixed.find((item) => sectionsOverlap(section, item));
			if (other) block = { code: "overlapsFixed", otherId: other.course.id };
		}
		if (!block && section.credits > budget + CREDIT_EPSILON) {
			block = { code: "overCredits", fixedCredits };
		}
		if (block) {
			blocked.set(section.course.id, block);
			continue;
		}
		if (!groupsByCode.has(section.code)) groupsByCode.set(section.code, []);
		groupsByCode.get(section.code).push(section);
	}

	const groups = [...groupsByCode.values()].map((options) => {
		options.sort(
			(a, b) =>
				Number(b.pinned) - Number(a.pinned) ||
				b.credits - a.credits ||
				a.index - b.index,
		);
		return {
			options,
			hasSelected: options.some((option) => option.selected),
			maxCredits: Math.max(...options.map((option) => option.credits)),
			firstIndex: Math.min(...options.map((option) => option.index)),
		};
	});
	// Most constrained useful choices first: planner courses, then fewer options.
	groups.sort(
		(a, b) =>
			Number(b.hasSelected) - Number(a.hasSelected) ||
			a.options.length - b.options.length ||
			a.firstIndex - b.firstIndex,
	);

	const suffixSelected = new Array(groups.length + 1).fill(0);
	const suffixCredits = new Array(groups.length + 1).fill(0);
	const suffixPinned = new Array(groups.length + 1).fill(0);
	for (let i = groups.length - 1; i >= 0; i -= 1) {
		suffixSelected[i] = suffixSelected[i + 1] + Number(groups[i].hasSelected);
		suffixCredits[i] = suffixCredits[i + 1] + groups[i].maxCredits;
		suffixPinned[i] =
			suffixPinned[i + 1] +
			Number(groups[i].options.some((option) => option.pinned));
	}

	const fixedMeetings = fixed.flatMap((item) => item.meetings);
	const fixedMask = dayMask(fixedMeetings);
	const fixedSelected = fixed.filter((item) => item.selected).length;
	const top = [];
	const chosen = [];
	let nodes = 0;
	let truncated = false;

	function scoreOf(selectedCount, credits, mask, earliest, pinnedCount) {
		return {
			selectedCount,
			credits,
			dayCount: countBits(mask),
			earliestStart: earliest,
			pinnedCount,
		};
	}

	function record(score) {
		const picks = [...fixed, ...chosen];
		if (!picks.length) return;
		const ordered = [...picks].sort((a, b) => a.index - b.index);
		const entry = {
			score,
			order: ordered.map((item) => item.index),
			sections: ordered,
		};
		let position = top.length;
		while (position > 0 && rankAhead(entry, top[position - 1])) position -= 1;
		if (position >= maxAlternatives) return;
		top.splice(position, 0, entry);
		if (top.length > maxAlternatives) top.pop();
	}

	function visit(depth, credits, selectedCount, mask, earliest, pinned) {
		if (nodes >= nodeLimit) {
			truncated = true;
			return;
		}
		nodes += 1;

		if (top.length >= maxAlternatives) {
			const bound = scoreOf(
				selectedCount + suffixSelected[depth],
				Math.min(constraints.maxCredits, credits + suffixCredits[depth]),
				mask,
				earliest,
				pinned + suffixPinned[depth],
			);
			// Equal bounds cannot change the ranked scores, only which of several
			// equally ranked schedules is shown, so they are pruned too.
			if (compareScores(bound, top[top.length - 1].score) <= 0) return;
		}

		if (depth === groups.length) {
			record(scoreOf(selectedCount, credits, mask, earliest, pinned));
			return;
		}

		for (const option of groups[depth].options) {
			if (truncated) return;
			if (credits + option.credits > constraints.maxCredits + CREDIT_EPSILON) {
				continue;
			}
			if (chosen.some((item) => sectionsOverlap(item, option))) continue;
			chosen.push(option);
			visit(
				depth + 1,
				credits + option.credits,
				selectedCount + Number(option.selected),
				mask | option.mask,
				option.earliest === null
					? earliest
					: earliest === null
						? option.earliest
						: Math.min(earliest, option.earliest),
				pinned + Number(option.pinned),
			);
			chosen.pop();
		}
		if (!truncated) {
			visit(depth + 1, credits, selectedCount, mask, earliest, pinned);
		}
	}

	visit(
		0,
		fixedCredits,
		fixedSelected,
		fixedMask,
		earliestOf(fixedMeetings),
		fixed.filter((item) => item.pinned).length,
	);

	return {
		status: "ok",
		alternatives: top.map(({ score, sections: picks }) => {
			const meetings = picks.flatMap((item) => item.meetings);
			const mask = dayMask(meetings);
			return {
				courseIds: picks.map((item) => item.course.id),
				facts: {
					...score,
					latestEnd: latestOf(meetings),
					days: DAYS.filter((_, index) => mask & (1 << index)),
					courseCount: picks.length,
				},
			};
		}),
		truncated,
		nodesExplored: nodes,
		blocked,
		fixedIds,
		constraints,
	};
}

/** Ties on the score fall back to cart order so results are deterministic. */
function rankAhead(a, b) {
	const byScore = compareScores(a.score, b.score);
	if (byScore !== 0) return byScore > 0;
	const length = Math.min(a.order.length, b.order.length);
	for (let i = 0; i < length; i += 1) {
		if (a.order[i] !== b.order[i]) return a.order[i] < b.order[i];
	}
	return a.order.length < b.order.length;
}

/**
 * A short, stable fingerprint of everything a search result depends on, used
 * to refuse applying a preview after the cart or constraints changed.
 */
export function planInputsFingerprint(courses, constraints) {
	const payload = JSON.stringify({
		courses: courses.map((course) => [
			course.id,
			course.courseCode,
			course.section,
			course.credits,
			course.status ?? null,
			(course.components ?? []).map((part) => [
				part.days,
				part.timeRange,
				Boolean(part.isTBA),
			]),
		]),
		constraints,
	});
	let hash = 0x811c9dc5;
	for (let i = 0; i < payload.length; i += 1) {
		hash ^= payload.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36) + payload.length.toString(36);
}
