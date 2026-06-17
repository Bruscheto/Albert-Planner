import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	getCourseMatchKeys,
	resolveNyuProfessorMatch,
} from "../../src/rmp-service.js";

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
