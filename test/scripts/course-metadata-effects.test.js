import assert from "node:assert/strict";
import { createCourseMetadataEffects } from "../../src/metadata/course-metadata-effects.js";

const sentMessages = [];
const savedRatings = [];
const dispatchedEvents = [];

const effects = createCourseMetadataEffects({
	sendMessage: async (message) => {
		sentMessages.push(message);
		return { status: "matched", data: { avgRating: 4.3 } };
	},
	setProfessorRating: async (professorName, rating) => {
		savedRatings.push({ professorName, rating });
	},
	dispatchRatingChange: () => {
		dispatchedEvents.push("professor-ratings-changed");
	},
});

const course = { id: "CSCI-UA-101-001", courseCode: "CSCI-UA 101" };
const firstLookup = await effects.lookupRmpProfessor("Ada Lovelace", course);
const secondLookup = await effects.lookupRmpProfessor("Ada Lovelace", course);
const otherLookup = await effects.lookupRmpProfessor("Ada Lovelace", {
	...course,
	id: "CSCI-UA-101-002",
});

assert.equal(firstLookup.status, "matched");
assert.equal(secondLookup.status, "matched");
assert.equal(otherLookup.status, "matched");
assert.deepEqual(
	sentMessages.map((message) => ({
		type: message.type,
		professorName: message.professorName,
		courseId: message.course.id,
	})),
	[
		{
			type: "LOOKUP_RMP_PROFESSOR",
			professorName: "Ada Lovelace",
			courseId: "CSCI-UA-101-001",
		},
		{
			type: "LOOKUP_RMP_PROFESSOR",
			professorName: "Ada Lovelace",
			courseId: "CSCI-UA-101-002",
		},
	],
);

assert.deepEqual(
	await effects.saveManualProfessorRating("Ada Lovelace", ""),
	{ rating: null },
);
assert.deepEqual(
	await effects.saveManualProfessorRating("Ada Lovelace", "7"),
	{ rating: 5 },
);
assert.deepEqual(
	await effects.saveManualProfessorRating("Ada Lovelace", "2.5"),
	{ rating: 2.5 },
);

assert.deepEqual(savedRatings, [
	{ professorName: "Ada Lovelace", rating: null },
	{ professorName: "Ada Lovelace", rating: 5 },
	{ professorName: "Ada Lovelace", rating: 2.5 },
]);
assert.deepEqual(dispatchedEvents, [
	"professor-ratings-changed",
	"professor-ratings-changed",
	"professor-ratings-changed",
]);

console.log("Course metadata effects tests passed");
