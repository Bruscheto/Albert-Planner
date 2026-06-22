import assert from "node:assert/strict";
import {
	clearCourseData,
	createBucket,
	getBuckets,
	getCourses,
	getPlannerSelection,
	getProfessorRatings,
	replaceCoursesFromAlbert,
	setProfessorRating,
	updateBucket,
} from "../../src/storage/course-storage.js";
import { STORAGE_KEYS } from "../../src/shared/constants.js";

function createChromeStorage(initial = {}) {
	const data = structuredClone(initial);
	return {
		local: {
			async get(keys) {
				if (keys === null) return structuredClone(data);
				const keyList = Array.isArray(keys)
					? keys
					: typeof keys === "string"
						? [keys]
						: Object.keys(keys || {});
				return Object.fromEntries(
					keyList
						.filter((key) => key in data)
						.map((key) => [key, structuredClone(data[key])]),
				);
			},
			async set(items) {
				for (const [key, value] of Object.entries(items)) {
					data[key] = structuredClone(value);
				}
			},
			async clear() {
				for (const key of Object.keys(data)) {
					delete data[key];
				}
			},
		},
		_dump: () => structuredClone(data),
	};
}

function course(id, bucket = null) {
	return {
		id,
		courseCode: id.toUpperCase(),
		section: "001",
		title: `${id} title`,
		credits: 4,
		status: "In Cart",
		components: [
			{
				type: "Lecture",
				section: "001",
				days: ["Mon"],
				timeRange: {
					start: { hours: 9, minutes: 0 },
					end: { hours: 10, minutes: 0 },
				},
				room: "Room 1",
				instructor: "Ada Lovelace",
				isTBA: false,
				status: "In Cart",
			},
		],
		bucket,
		addedAt: 1,
	};
}

globalThis.chrome = {
	storage: createChromeStorage({
		[STORAGE_KEYS.COURSES]: [course("old-a")],
		[STORAGE_KEYS.BUCKETS]: [
			{ id: "low", name: "Low", color: "#222", priority: 20 },
			{ id: "high", name: "High", color: "#111", priority: 10 },
		],
		[STORAGE_KEYS.PLANNER_SELECTION]: ["new-a", "stale-course", "new-a"],
		[STORAGE_KEYS.PROFESSOR_RATINGS]: { Ada: 4.8, Grace: 4.2 },
		activeTerm: { name: "Old Term" },
	}),
};

const activeTerm = {
	name: "Fall 2026",
	semester: "Fall",
	year: 2026,
	termCode: "1268",
};

await replaceCoursesFromAlbert({
	courses: [course("new-a", "required"), course("new-b")],
	activeTerm,
});

assert.deepEqual(
	(await getCourses()).map((storedCourse) => storedCourse.id),
	["new-a", "new-b"],
);
assert.deepEqual(await getPlannerSelection(), ["new-a"]);
assert.deepEqual(chrome.storage._dump().activeTerm, activeTerm);

await assert.rejects(
	() =>
		replaceCoursesFromAlbert({
			courses: [{ id: "broken" }],
			activeTerm,
		}),
	/Course code is required/,
);

await clearCourseData();

assert.deepEqual(await getCourses(), []);
assert.deepEqual(await getPlannerSelection(), []);
assert.equal(chrome.storage._dump().activeTerm, null);

const createdBucketId = await createBucket({
	name: "Medium",
	color: "#333",
	priority: 15,
});
assert.deepEqual(
	(await getBuckets()).map((bucket) => bucket.name),
	["High", "Medium", "Low"],
);

await updateBucket(createdBucketId, {
	name: "Updated Medium",
	color: "#444",
	priority: 5,
});
assert.deepEqual(
	(await getBuckets()).map((bucket) => bucket.name),
	["Updated Medium", "High", "Low"],
);
assert.deepEqual(chrome.storage._dump()[STORAGE_KEYS.PROFESSOR_RATINGS], {
	Ada: 4.8,
	Grace: 4.2,
});

await setProfessorRating("Grace", null);
assert.deepEqual(await getProfessorRatings(), { Ada: 4.8 });

await setProfessorRating("Katherine", "5");
assert.deepEqual(await getProfessorRatings(), { Ada: 4.8, Katherine: 5 });

console.log(
	"Course storage tests passed: replace, clear, buckets, professor ratings",
);
