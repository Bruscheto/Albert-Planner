import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	findMostRecentSameCourseRating,
	getCourseMatchKeys,
	resolveNyuProfessorMatch,
} from "../../src/rmp/rmp-service.js";

function assertSharedCourseKey(left, right) {
	const leftKeys = getCourseMatchKeys(left);
	const rightKeys = getCourseMatchKeys(right);
	assert.ok(
		[...leftKeys].some((key) => rightKeys.has(key)),
		`${left} should share a normalized course key with ${right}`,
	);
}

assertSharedCourseKey("CORE-UA 203", "COREUA203");
assertSharedCourseKey("CORE-UA 203", "CORE203");
assertSharedCourseKey("CHEM-UA 0125-001", "CHEM125");

const sameCourseRating = findMostRecentSameCourseRating("CORE-UA 203", [
	{
		id: "old-same-course",
		class: "CORE203",
		comment: "Older same course review.",
		date: "2025-12-09 03:00:05 +0000 UTC",
		difficultyRating: 1,
	},
	{
		id: "latest-same-course",
		class: "COREUA203",
		comment: "Most recent same course review.",
		date: "2026-04-04 20:14:37 +0000 UTC",
		difficultyRating: 2,
	},
	{
		id: "different-course",
		class: "CHEM126",
		comment: "Different course review.",
		date: "2026-05-24 03:50:43 +0000 UTC",
		difficultyRating: 3,
	},
]);
assert.equal(sameCourseRating?.id, "latest-same-course");
assert.equal(sameCourseRating?.classLabel, "COREUA203");
assert.equal(sameCourseRating?.comment, "Most recent same course review.");

const fixtures = await Promise.all(
	[
		"../fixtures/fall-2026-professor-match-cases.json",
		"../fixtures/cas-core-2025-2026-professor-match-cases.json",
	].map(async (fixturePath) =>
		JSON.parse(await readFile(new URL(fixturePath, import.meta.url), "utf8")),
	),
);

let passedCount = 0;

for (const fixture of fixtures) {
	for (const testCase of fixture.cases) {
		const result = resolveNyuProfessorMatch({
			professorName: testCase.professorName,
			courseCode: testCase.courseCode,
			courseTitle: testCase.courseTitle,
			candidates: fixture.candidateSets[testCase.candidateSet],
		});

		assert.equal(
			result.status,
			testCase.expectedStatus,
			`${testCase.id} should be ${testCase.expectedStatus}, got ${result.status}`,
		);

		if (testCase.expectedProfessorName) {
			assert.equal(
				result.professor?.name,
				testCase.expectedProfessorName,
				`${testCase.id} matched wrong professor`,
			);
		}

		if (testCase.expectedStatus === "ambiguous") {
			assert.ok(
				result.candidates.length >= 2,
				`${testCase.id} should expose ambiguous candidates`,
			);
		}

		passedCount += 1;
	}
}

console.log(`RMP matcher tests passed: ${passedCount}`);
