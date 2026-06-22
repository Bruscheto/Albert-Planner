import assert from "node:assert/strict";
import { createWeeklyScheduleModel } from "../../src/weekly-view/schedule-model.js";

function time(hours, minutes = 0) {
	return { hours, minutes };
}

function course(id, {
	courseCode = id.toUpperCase(),
	credits = 4,
	bucket = null,
	components,
}) {
	return {
		id,
		courseCode,
		section: "001",
		title: `${courseCode} title`,
		credits,
		status: "In Cart",
		components,
		bucket,
		addedAt: 1,
	};
}

const courses = [
	course("cs-a", {
		courseCode: "CSCI-UA 101",
		components: [
			{
				type: "Lecture",
				section: "001",
				days: ["Mon", "Wed"],
				timeRange: { start: time(9), end: time(10, 15) },
				room: "WWH 101",
				instructor: "Ada Lovelace",
				isTBA: false,
				status: "In Cart",
			},
			{
				type: "Recitation",
				section: "002",
				days: [],
				timeRange: null,
				room: "TBA",
				instructor: "TBA",
				isTBA: true,
				status: "In Cart",
			},
		],
	}),
	course("math-b", {
		courseCode: "MATH-UA 121",
		components: [
			{
				type: "Lecture",
				section: "001",
				days: ["Mon"],
				timeRange: { start: time(10), end: time(11) },
				room: "WWH 102",
				instructor: "Grace Hopper",
				isTBA: false,
				status: "In Cart",
			},
		],
	}),
	course("hist-c", {
		courseCode: "HIST-UA 010",
		components: [
			{
				type: "Lecture",
				section: "001",
				days: ["Fri"],
				timeRange: { start: time(14), end: time(15) },
				room: "KJCC 201",
				instructor: "Jane Jacobs",
				isTBA: false,
				status: "In Cart",
			},
		],
	}),
];

const model = createWeeklyScheduleModel({
	courses,
	buckets: [],
	plannerSelection: ["cs-a", "math-b", "missing"],
});

assert.deepEqual(model.plannedCourses.map((plannedCourse) => plannedCourse.id), [
	"cs-a",
	"math-b",
]);
assert.equal(model.plannedSchedule.length, 3);
assert.deepEqual([...model.plannerSelectionSet], ["cs-a", "math-b", "missing"]);
assert.equal(model.stats.totalCourses, 2);
assert.equal(model.stats.totalCredits, 8);
assert.equal(model.stats.weeklyHours, 3.5);
assert.deepEqual(model.stats.earliestStart, time(9));
assert.deepEqual(model.stats.latestEnd, time(11));
assert.deepEqual(model.conflictCourseIds, new Set(["cs-a", "math-b"]));
assert.equal(model.conflicts.length, 2);
assert.deepEqual(model.incompleteWarnings, [
	{ course: courses[0], missingTypes: ["Recitation"] },
]);

console.log("Weekly schedule model tests passed");
