import assert from "node:assert/strict";
import {
	NODE_LIMIT,
	planInputsFingerprint,
	searchSchedules,
} from "../../src/planner/search.js";
import {
	describeFailure,
	diffAlternatives,
	explainAlternative,
	sortOrderText,
	summarizeFacts,
} from "../../src/planner/explanations.js";
import { suggestSchedule } from "../../apps/web/suggest.js";

const ALL_DAYS_OPEN = {
	maxCredits: 18,
	earliestMinutes: 0,
	unavailableDays: [],
	lockedCourseIds: [],
	excludedCourseIds: [],
};

function meeting(days, start, end, type = "Lecture") {
	const [sh, sm = 0] = start;
	const [eh, em = 0] = end;
	return {
		type,
		days,
		timeRange: {
			start: { hours: sh, minutes: sm },
			end: { hours: eh, minutes: em },
		},
		isTBA: false,
	};
}

function section(id, code, sectionNumber, components, credits = 4, extra = {}) {
	return {
		id,
		courseCode: code,
		section: sectionNumber,
		title: `${code} title`,
		credits,
		components,
		...extra,
	};
}

function rules(patch = {}) {
	return { ...ALL_DAYS_OPEN, ...patch };
}

// --- Greedy misses, search finds ------------------------------------------
{
	const courses = [
		section("a1", "MATH-UA 121", "001", [
			meeting(["Mon", "Wed"], [9], [11]),
		]),
		section("a2", "MATH-UA 121", "002", [meeting(["Fri"], [9], [11])]),
		section("b", "CSCI-UA 201", "001", [meeting(["Mon"], [10], [11])]),
		section("c", "CSCI-UA 202", "001", [meeting(["Wed"], [10], [11])]),
	];
	const selection = ["a1", "b", "c"];

	const greedy = suggestSchedule(
		{ courses, selection },
		{ ...rules(), maxCredits: 18 },
	);
	assert.deepEqual(greedy.selection, ["a1"], "baseline greedy keeps the blocking section");

	const result = searchSchedules({
		courses,
		selectedIds: selection,
		constraints: rules(),
	});
	assert.equal(result.status, "ok");
	assert.equal(result.truncated, false);
	assert.deepEqual(result.alternatives[0].courseIds, ["a2", "b", "c"]);
	assert.equal(result.alternatives[0].facts.credits, 12);
	assert.deepEqual(result.alternatives[0].facts.days, ["Mon", "Wed", "Fri"]);

	const entries = explainAlternative(
		result,
		result.alternatives[0],
		courses,
		selection,
	);
	assert.equal(entries.length, courses.length, "every cart course is explained");
	const a1 = entries.find((entry) => entry.courseId === "a1");
	assert.equal(a1.status, "skipped");
	assert.match(a1.reason, /Section 002 of this course is in this option/);
}

// --- Required course cannot fit -----------------------------------------
{
	const courses = [
		section("req", "CSCI-UA 202", "001", [meeting(["Fri"], [11], [12, 15])]),
		section("x", "EXPOS-UA 1", "004", [meeting(["Tue"], [9], [10])]),
	];
	const constraints = rules({
		unavailableDays: ["Fri"],
		lockedCourseIds: ["req"],
	});
	const result = searchSchedules({ courses, constraints });
	assert.equal(result.status, "required-failed");
	assert.equal(result.alternatives.length, 0);
	assert.equal(result.failure.courseId, "req");
	const message = describeFailure(result.failure, courses, result.constraints);
	assert.match(message, /CSCI-UA 202 · 001/);
	assert.match(message, /Fri, marked unavailable/);

	const early = searchSchedules({
		courses,
		constraints: rules({ earliestMinutes: 12 * 60, lockedCourseIds: ["req"] }),
	});
	assert.equal(early.status, "required-failed");
	assert.match(
		describeFailure(early.failure, courses, early.constraints),
		/starts at 11:00 AM, before 12:00 PM/,
	);

	const clash = [
		section("r1", "CSCI-UA 201", "001", [meeting(["Mon"], [9], [10])]),
		section("r2", "CSCI-UA 202", "001", [meeting(["Mon"], [9, 30], [10, 30])]),
	];
	const both = searchSchedules({
		courses: clash,
		constraints: rules({ lockedCourseIds: ["r1", "r2"] }),
	});
	assert.equal(both.status, "required-failed");
	assert.match(
		describeFailure(both.failure, clash, both.constraints),
		/CSCI-UA 201 · 001 .*overlaps required CSCI-UA 202 · 001 on Mon/,
	);

	const apart = [
		section("r1", "CSCI-UA 201", "001", [meeting(["Tue"], [9], [10])]),
		section("r2", "CSCI-UA 202", "001", [meeting(["Thu"], [9], [10])]),
	];
	const heavy = searchSchedules({
		courses: apart,
		constraints: rules({ maxCredits: 6, lockedCourseIds: ["r1", "r2"] }),
	});
	assert.equal(heavy.status, "required-failed");
	assert.match(
		describeFailure(heavy.failure, apart, heavy.constraints),
		/already total 8 credits, over your 6 credits limit/,
	);

	const twoSections = [
		section("s1", "CSCI-UA 201", "001", [meeting(["Mon"], [9], [10])]),
		section("s2", "CSCI-UA 201", "002", [meeting(["Tue"], [9], [10])]),
	];
	const dup = searchSchedules({
		courses: twoSections,
		constraints: rules({ lockedCourseIds: ["s1", "s2"] }),
	});
	assert.equal(dup.status, "required-failed");
	assert.match(
		describeFailure(dup.failure, twoSections, dup.constraints),
		/Keep one section per course/,
	);
}

// --- TBA sections are never auto-picked ---------------------------------
{
	const courses = [
		section("tba", "ARTH-UA 10", "001", [
			{ type: "Lecture", days: [], timeRange: null, isTBA: true },
		]),
		section("ok", "ARTH-UA 20", "001", [meeting(["Tue"], [12], [13])]),
	];
	const result = searchSchedules({
		courses,
		selectedIds: ["tba", "ok"],
		constraints: rules(),
	});
	assert.deepEqual(result.alternatives[0].courseIds, ["ok"]);
	const entry = explainAlternative(result, result.alternatives[0], courses).find(
		(item) => item.courseId === "tba",
	);
	assert.equal(entry.status, "unknown");
	assert.equal(entry.reason, "Meeting times are unconfirmed");

	const locked = searchSchedules({
		courses,
		constraints: rules({ lockedCourseIds: ["tba"] }),
	});
	assert.equal(locked.status, "required-failed");
	assert.match(
		describeFailure(locked.failure, courses, locked.constraints),
		/meeting times are unconfirmed/,
	);
}

// --- Credit ceiling ------------------------------------------------------
{
	const courses = ["a", "b", "c", "d", "e"].map((id, index) =>
		section(id, `CORE-UA ${index + 1}`, "001", [
			meeting([["Mon", "Tue", "Wed", "Thu", "Fri"][index]], [10], [11]),
		]),
	);
	const result = searchSchedules({ courses, constraints: rules({ maxCredits: 16 }) });
	assert.equal(result.alternatives[0].facts.credits, 16);
	assert.ok(result.alternatives.every((alt) => alt.facts.credits <= 16));
	const skipped = explainAlternative(result, result.alternatives[0], courses).find(
		(entry) => entry.status === "skipped",
	);
	assert.match(skipped.reason, /Would bring this option to 20 credits, over your 16 credits limit/);

	const odd = [
		section("big", "PHYS-UA 91", "001", [meeting(["Mon"], [9], [12])], 5),
		section("small", "PHYS-UA 92", "001", [meeting(["Tue"], [9], [10])], 2),
		section("mid", "PHYS-UA 93", "001", [meeting(["Wed"], [9], [10])], 4),
	];
	const near = searchSchedules({ courses: odd, constraints: rules({ maxCredits: 7 }) });
	assert.deepEqual(near.alternatives[0].courseIds, ["big", "small"], "closest to the ceiling wins");
}

// --- Unavailable day and earliest start ---------------------------------
{
	const courses = [
		section("fri", "HIST-UA 1", "001", [meeting(["Fri"], [13], [14])]),
		section("early", "HIST-UA 2", "001", [meeting(["Tue"], [8], [9, 15])]),
		section("fine", "HIST-UA 3", "001", [meeting(["Thu"], [11], [12, 15])]),
	];
	const result = searchSchedules({
		courses,
		constraints: rules({ unavailableDays: ["Fri"], earliestMinutes: 10 * 60 }),
	});
	assert.deepEqual(result.alternatives[0].courseIds, ["fine"]);
	const reasons = Object.fromEntries(
		explainAlternative(result, result.alternatives[0], courses).map((entry) => [
			entry.courseId,
			entry.reason,
		]),
	);
	assert.equal(reasons.fri, "Meets on Fri, marked unavailable");
	assert.equal(reasons.early, "Starts at 8:00 AM, before 10:00 AM");
	assert.equal(reasons.fine, "Fits your rules");
}

// --- Exclusions and enrolled commitments --------------------------------
{
	const courses = [
		section("enrolled", "SPAN-UA 1", "001", [meeting(["Mon", "Wed"], [9], [10])], 4, {
			status: "Enrolled",
		}),
		section("clash", "SPAN-UA 2", "001", [meeting(["Mon"], [9, 30], [10, 30])]),
		section("excluded", "SPAN-UA 3", "001", [meeting(["Tue"], [9], [10])]),
		section("free", "SPAN-UA 4", "001", [meeting(["Thu"], [9], [10])]),
	];
	const result = searchSchedules({
		courses,
		constraints: rules({ excludedCourseIds: ["excluded"] }),
	});
	assert.deepEqual(result.alternatives[0].courseIds, ["enrolled", "free"]);
	assert.ok(
		result.alternatives.every((alt) => alt.courseIds.includes("enrolled")),
		"enrolled courses stay in every option",
	);
	const reasons = Object.fromEntries(
		explainAlternative(result, result.alternatives[0], courses).map((entry) => [
			entry.courseId,
			entry.reason,
		]),
	);
	assert.equal(reasons.enrolled, "Already enrolled");
	assert.equal(reasons.clash, "Overlaps enrolled SPAN-UA 1 · 001 on Mon");
	assert.equal(reasons.excluded, "Excluded by you");
}

// --- Top three distinct alternatives with a deterministic order ---------
{
	const courses = [
		section("m1", "MATH-UA 140", "001", [meeting(["Mon", "Wed"], [9, 30], [10, 45])]),
		section("m2", "MATH-UA 140", "002", [meeting(["Tue", "Thu"], [12, 30], [13, 45])]),
		section("m3", "MATH-UA 140", "003", [meeting(["Mon", "Wed"], [14], [15, 15])]),
		section("w1", "WRIT-UA 1", "001", [meeting(["Tue", "Thu"], [11], [12, 15])]),
		section("w2", "WRIT-UA 1", "002", [meeting(["Mon", "Wed"], [11], [12, 15])]),
		section("p1", "PSYCH-UA 1", "001", [meeting(["Mon", "Wed"], [12, 30], [13, 45])]),
	];
	const input = { courses, constraints: rules({ maxCredits: 12 }) };
	const first = searchSchedules(input);
	const second = searchSchedules(input);
	assert.equal(first.alternatives.length, 3);
	assert.deepEqual(
		first.alternatives.map((alt) => alt.courseIds),
		second.alternatives.map((alt) => alt.courseIds),
		"ranking is deterministic",
	);
	const keys = new Set(first.alternatives.map((alt) => alt.courseIds.join(",")));
	assert.equal(keys.size, 3, "alternatives are distinct");
	// All reach 12 credits; Mon/Wed-only options rank first, and of those the
	// later first class (m3 at 2 PM leaves 11 AM as the start) wins.
	assert.deepEqual(first.alternatives[0].courseIds, ["m3", "w2", "p1"]);
	assert.deepEqual(first.alternatives[1].courseIds, ["m1", "w2", "p1"]);
	assert.deepEqual(first.alternatives[0].facts.days, ["Mon", "Wed"]);
	for (let i = 1; i < first.alternatives.length; i += 1) {
		const prev = first.alternatives[i - 1].facts;
		const next = first.alternatives[i].facts;
		assert.ok(
			prev.credits > next.credits ||
				(prev.credits === next.credits && prev.dayCount <= next.dayCount),
			"later options never rank ahead on the stated order",
		);
	}
	assert.equal(
		sortOrderText(),
		"Sorted by more courses from your planner, then credits closest to your limit, then fewer class days, then later first class, then keeping the sections you picked.",
	);
	assert.doesNotMatch(sortOrderText(), /best|optimal/i);
	assert.deepEqual(diffAlternatives(first.alternatives[0], first.alternatives[1]), {
		added: ["m1"],
		removed: ["m3"],
	});
	assert.deepEqual(summarizeFacts(first.alternatives[0].facts), [
		"12 credits",
		"2 days (Mon Wed)",
		"11:00 AM–3:15 PM",
	]);
}

// --- Truncation is labeled, never reported as no fit --------------------
{
	const courses = [];
	for (let code = 0; code < 14; code += 1) {
		for (let n = 0; n < 3; n += 1) {
			courses.push(
				section(`c${code}-${n}`, `GEN-UA ${code}`, `00${n + 1}`, [
					meeting([["Mon", "Tue", "Wed", "Thu", "Fri"][(code + n) % 5]], [8 + n * 2 + (code % 2)], [9 + n * 2 + (code % 2)]),
				], 1),
			);
		}
	}
	const limited = searchSchedules({
		courses,
		constraints: rules({ maxCredits: 30 }),
		nodeLimit: 500,
	});
	assert.equal(limited.truncated, true);
	assert.equal(limited.nodesExplored, 500);
	assert.ok(limited.alternatives.length > 0, "a truncated search still returns what it found");
	assert.equal(NODE_LIMIT, 50000);

	const full = searchSchedules({ courses, constraints: rules({ maxCredits: 30 }) });
	assert.ok(full.nodesExplored <= NODE_LIMIT);
}

// --- Cart freshness fingerprint -----------------------------------------
{
	const courses = [section("a", "A-UA 1", "001", [meeting(["Mon"], [9], [10])])];
	const base = planInputsFingerprint(courses, rules());
	assert.equal(base, planInputsFingerprint(structuredClone(courses), rules()));
	const moved = structuredClone(courses);
	moved[0].components[0].timeRange.start.hours = 8;
	assert.notEqual(base, planInputsFingerprint(moved, rules()));
	assert.notEqual(base, planInputsFingerprint(courses, rules({ maxCredits: 12 })));
}

// --- Invalid constraints are rejected before searching ------------------
{
	const courses = [section("a", "A-UA 1", "001", [meeting(["Mon"], [9], [10])])];
	assert.throws(
		() =>
			searchSchedules({
				courses,
				constraints: rules({ lockedCourseIds: ["a"], excludedCourseIds: ["a"] }),
			}),
		/both required and excluded/,
	);
	assert.throws(() =>
		searchSchedules({ courses, constraints: rules({ lockedCourseIds: ["ghost"] }) }),
	);
}

console.log(
	"Schedule search tests passed: greedy miss, required failures, TBA, credit ceiling, days/start, enrolled, ranking, truncation, freshness",
);

// --- Randomized cross-check against exhaustive enumeration --------------
{
	const { compareScores } = await import("../../src/planner/search.js");
	let seed = 20261009;
	const random = () => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
	for (let trial = 0; trial < 150; trial += 1) {
		const courses = [];
		const codeCount = 2 + Math.floor(random() * 4);
		for (let code = 0; code < codeCount; code += 1) {
			const sectionCount = 1 + Math.floor(random() * 3);
			for (let n = 0; n < sectionCount; n += 1) {
				const start = 8 + Math.floor(random() * 8);
				const pattern = random() < 0.5 ? [days[Math.floor(random() * 5)]] : ["Mon", "Wed"];
				courses.push(
					section(`t${code}-${n}`, `RAND-UA ${code}`, `00${n + 1}`, [
						meeting(pattern, [start], [start + 1, 15]),
					], 2 + Math.floor(random() * 3)),
				);
			}
		}
		const selectedIds = courses.filter(() => random() < 0.3).map((course) => course.id);
		const constraints = rules({
			maxCredits: 6 + Math.floor(random() * 8),
			earliestMinutes: random() < 0.3 ? 9 * 60 : 0,
		});
		const result = searchSchedules({ courses, selectedIds, constraints });

		// Exhaustive: every subset with at most one section per code, no overlaps.
		const selectedCodes = new Set(
			courses.filter((course) => selectedIds.includes(course.id)).map((course) => course.courseCode),
		);
		const scores = [];
		const total = 2 ** courses.length;
		for (let mask = 1; mask < total; mask += 1) {
			const picks = courses.filter((_, index) => mask & (1 << index));
			const codes = picks.map((course) => course.courseCode);
			if (new Set(codes).size !== codes.length) continue;
			const credits = picks.reduce((sum, course) => sum + course.credits, 0);
			if (credits > constraints.maxCredits) continue;
			const parts = picks.flatMap((course) => course.components);
			if (parts.some((part) => timeOf(part.timeRange.start) < constraints.earliestMinutes)) continue;
			let clash = false;
			for (let i = 0; i < parts.length && !clash; i += 1) {
				for (let j = i + 1; j < parts.length && !clash; j += 1) {
					clash =
						parts[i].days.some((day) => parts[j].days.includes(day)) &&
						timeOf(parts[i].timeRange.start) < timeOf(parts[j].timeRange.end) &&
						timeOf(parts[j].timeRange.start) < timeOf(parts[i].timeRange.end);
				}
			}
			if (clash) continue;
			scores.push({
				selectedCount: picks.filter((course) => selectedCodes.has(course.courseCode)).length,
				credits,
				dayCount: new Set(parts.flatMap((part) => part.days)).size,
				earliestStart: Math.min(...parts.map((part) => timeOf(part.timeRange.start))),
				pinnedCount: picks.filter((course) => selectedIds.includes(course.id)).length,
			});
		}
		scores.sort((a, b) => compareScores(b, a));
		const expected = scores.slice(0, 3);
		assert.equal(result.alternatives.length, expected.length, `trial ${trial}: count`);
		result.alternatives.forEach((alt, index) => {
			assert.equal(
				compareScores(alt.facts, expected[index]),
				0,
				`trial ${trial}: alternative ${index} matches exhaustive rank`,
			);
		});
	}

	function timeOf(time) {
		return time.hours * 60 + time.minutes;
	}
	console.log("Schedule search cross-check passed: 150 random carts match exhaustive enumeration");
}
