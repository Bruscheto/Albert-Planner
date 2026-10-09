// Explanations rendered from computed facts. No model writes any of this text.

import { DAYS } from "../shared/constraints.js";
import { doTimesOverlap, formatTime } from "../shared/time-parser.js";
import {
	SORT_ORDER,
	hasUnconfirmedMeetings,
	isEnrolled,
	normalizeCourseCode,
} from "./search.js";

/**
 * @typedef {Object} ExplanationEntry
 * @property {string} courseId
 * @property {"included"|"skipped"|"unknown"} status
 * @property {string} reason
 */

export function formatMinutes(minutes) {
	if (!Number.isFinite(minutes)) return "";
	return formatTime({ hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

export function formatCredits(credits) {
	const value = Number.isInteger(credits) ? String(credits) : credits.toFixed(1);
	return `${value} ${credits === 1 ? "credit" : "credits"}`;
}

export function courseLabel(course) {
	if (!course) return "another course";
	return `${course.courseCode} · ${course.section}`;
}

function listDays(days) {
	const ordered = DAYS.filter((day) => days.includes(day));
	if (ordered.length <= 2) return ordered.join(" and ");
	return `${ordered.slice(0, -1).join(", ")} and ${ordered.at(-1)}`;
}

function overlapDays(a, b) {
	const days = new Set();
	for (const left of a.components ?? []) {
		for (const right of b.components ?? []) {
			if (!left.timeRange || !right.timeRange) continue;
			if (!doTimesOverlap(left.timeRange, right.timeRange)) continue;
			for (const day of left.days ?? []) {
				if (right.days?.includes(day)) days.add(day);
			}
		}
	}
	return [...days];
}

/**
 * Text for a reason a section can never be chosen under these constraints.
 * @param {import("./search.js").StaticBlock} block
 * @param {object} course
 * @param {Map<string, object>} byId
 * @param {import("./search.js").Constraints} constraints
 */
export function describeBlock(block, course, byId, constraints) {
	switch (block.code) {
		case "excluded":
			return "Excluded by you";
		case "unconfirmed":
			return "Meeting times are unconfirmed";
		case "beforeEarliest":
			return `Starts at ${formatMinutes(block.startMinutes)}, before ${formatMinutes(constraints.earliestMinutes)}`;
		case "unavailableDay":
			return `Meets on ${listDays(block.days)}, marked unavailable`;
		case "selfOverlap":
			return "Its own meetings overlap each other";
		case "overCredits":
			return `${formatCredits(course.credits)} won't fit under your ${formatCredits(constraints.maxCredits)} limit`;
		case "sameCourseFixed": {
			const other = byId.get(block.otherId);
			const why = other && isEnrolled(other) ? "you're enrolled in" : "required";
			return `Section ${other?.section ?? "?"} of this course is ${why}`;
		}
		case "overlapsFixed": {
			const other = byId.get(block.otherId);
			const days = other ? overlapDays(course, other) : [];
			const why = other && isEnrolled(other) ? "enrolled" : "required";
			return `Overlaps ${why} ${courseLabel(other)}${days.length ? ` on ${listDays(days)}` : ""}`;
		}
		default:
			return "Doesn't fit your rules";
	}
}

/**
 * Explain why a required course cannot be placed, naming the course and the
 * blocking constraint.
 */
export function describeFailure(failure, courses, constraints) {
	const byId = new Map(courses.map((course) => [course.id, course]));
	const course = byId.get(failure.courseId);
	const label = course ? `${courseLabel(course)} (${course.title})` : "A required course";
	if (failure.code === "overCredits" && Number.isFinite(failure.credits)) {
		return `${label} is required, but required and enrolled courses already total ${formatCredits(failure.credits)}, over your ${formatCredits(constraints.maxCredits)} limit.`;
	}
	if (failure.code === "sameCourseFixed") {
		const other = byId.get(failure.otherId);
		return `${label} is required, but ${courseLabel(other)} is ${other && isEnrolled(other) ? "already enrolled" : "also required"}. Keep one section per course.`;
	}
	const reason = describeBlock(failure, course ?? { credits: 0 }, byId, constraints);
	return `${label} is required, but it can't be placed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`;
}

/**
 * Every course in the search input, as included, skipped with a reason, or
 * unknown, for one alternative.
 *
 * @param {import("./search.js").SearchResult} result
 * @param {import("./search.js").Alternative} alternative
 * @param {object[]} courses - The same courses passed to the search.
 * @param {string[]} [selectedIds]
 * @returns {ExplanationEntry[]}
 */
export function explainAlternative(result, alternative, courses, selectedIds = []) {
	const { constraints, blocked, fixedIds } = result;
	const byId = new Map(courses.map((course) => [course.id, course]));
	const included = new Set(alternative.courseIds);
	const includedCourses = alternative.courseIds.map((id) => byId.get(id));
	const selected = new Set(selectedIds);

	return courses.map((course) => {
		if (included.has(course.id)) {
			let reason = "Fits your rules";
			if (fixedIds.has(course.id)) {
				reason = constraints.lockedCourseIds.includes(course.id)
					? "Required by you"
					: "Already enrolled";
				if (hasUnconfirmedMeetings(course)) {
					reason += " · meeting times unconfirmed";
				}
			} else if (selected.has(course.id)) {
				reason = "In your planner";
			}
			return { courseId: course.id, status: "included", reason };
		}

		const block = blocked.get(course.id);
		if (block) {
			return {
				courseId: course.id,
				status: block.code === "unconfirmed" ? "unknown" : "skipped",
				reason: describeBlock(block, course, byId, constraints),
			};
		}

		const code = normalizeCourseCode(course.courseCode);
		const sibling = includedCourses.find(
			(other) => normalizeCourseCode(other.courseCode) === code,
		);
		if (sibling) {
			return {
				courseId: course.id,
				status: "skipped",
				reason: `Section ${sibling.section} of this course is in this option`,
			};
		}

		for (const other of includedCourses) {
			const days = overlapDays(course, other);
			if (days.length) {
				return {
					courseId: course.id,
					status: "skipped",
					reason: `Overlaps ${courseLabel(other)} on ${listDays(days)}`,
				};
			}
		}

		const total = alternative.facts.credits + course.credits;
		if (total > constraints.maxCredits + 1e-9) {
			return {
				courseId: course.id,
				status: "skipped",
				reason: `Would bring this option to ${formatCredits(total)}, over your ${formatCredits(constraints.maxCredits)} limit`,
			};
		}

		return {
			courseId: course.id,
			status: "skipped",
			reason: "Fits, but left out of this option",
		};
	});
}

/** One line naming the fixed sort order; results are never called best. */
export function sortOrderText() {
	return `Sorted by ${SORT_ORDER.map((item) => item.label).join(", then ")}.`;
}

/** Compact summary facts for an alternative card. */
export function summarizeFacts(facts) {
	const parts = [formatCredits(facts.credits)];
	parts.push(
		facts.dayCount === 0
			? "no timed classes"
			: `${facts.dayCount} ${facts.dayCount === 1 ? "day" : "days"} (${facts.days.join(" ")})`,
	);
	if (facts.earliestStart !== null && facts.latestEnd !== null) {
		parts.push(`${formatMinutes(facts.earliestStart)}–${formatMinutes(facts.latestEnd)}`);
	}
	return parts;
}

/**
 * What an alternative changes relative to the first one, so near-identical
 * options are easy to tell apart.
 * @returns {{ added: string[], removed: string[] }}
 */
export function diffAlternatives(base, other) {
	const baseIds = new Set(base.courseIds);
	const otherIds = new Set(other.courseIds);
	return {
		added: other.courseIds.filter((id) => !baseIds.has(id)),
		removed: base.courseIds.filter((id) => !otherIds.has(id)),
	};
}
