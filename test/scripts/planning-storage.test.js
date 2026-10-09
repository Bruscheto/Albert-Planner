import assert from "node:assert/strict";
import {
	DEFAULT_TERM_KEY,
	extensionDefaultConstraints,
	getCounters,
	incrementCounter,
	loadConstraints,
	resetCounters,
	resolveTermKey,
	saveConstraints,
} from "../../src/storage/planning-storage.js";
import { STORAGE_KEYS } from "../../src/shared/constants.js";

const data = {
	[STORAGE_KEYS.COURSES]: [{ id: "legacy" }],
	[STORAGE_KEYS.PLANNER_SELECTION]: ["legacy"],
};
globalThis.chrome = {
	storage: {
		local: {
			async get(key) {
				return key in data ? { [key]: structuredClone(data[key]) } : {};
			},
			async set(items) {
				for (const [key, value] of Object.entries(items)) data[key] = structuredClone(value);
			},
		},
	},
};

const course = (id, term = "Spring 2027") => ({
	id,
	courseCode: id.toUpperCase(),
	section: "001",
	title: id,
	credits: 4,
	components: [],
	term: { name: term },
});

// Term keys
assert.equal(resolveTermKey([course("a"), course("b")]), "Spring 2027");
assert.equal(resolveTermKey([course("a"), course("b", "Fall 2026")]), null);
assert.equal(resolveTermKey([], { name: "Fall 2026" }), "Fall 2026");
assert.equal(resolveTermKey([]), DEFAULT_TERM_KEY);

// Defaults when nothing is saved; v1 data stays untouched
const courses = [course("a"), course("b")];
assert.deepEqual((await loadConstraints("Spring 2027", courses)).constraints, extensionDefaultConstraints());
assert.equal(extensionDefaultConstraints().earliestMinutes, 0);
assert.equal(extensionDefaultConstraints().maxCredits, 18);

// Save per term, additively
await saveConstraints("Spring 2027", { ...extensionDefaultConstraints(), maxCredits: 16, lockedCourseIds: ["a"] }, courses);
await saveConstraints("Fall 2026", { ...extensionDefaultConstraints(), unavailableDays: ["Fri"] }, courses);
assert.equal((await loadConstraints("Spring 2027", courses)).constraints.maxCredits, 16);
assert.deepEqual((await loadConstraints("Fall 2026", courses)).constraints.unavailableDays, ["Fri"]);
assert.deepEqual(data[STORAGE_KEYS.COURSES], [{ id: "legacy" }], "existing keys are not rewritten");
assert.deepEqual(data[STORAGE_KEYS.PLANNER_SELECTION], ["legacy"]);

// Contradictions are rejected and the previous rules kept
await assert.rejects(
	saveConstraints("Spring 2027", { ...extensionDefaultConstraints(), lockedCourseIds: ["b"], excludedCourseIds: ["b"] }, courses),
	/both required and excluded/,
);
assert.deepEqual((await loadConstraints("Spring 2027", courses)).constraints.lockedCourseIds, ["a"]);

// Courses that left the cart drop out of saved rules, and are reported
const reloaded = await loadConstraints("Spring 2027", [course("b")]);
assert.deepEqual(reloaded.constraints.lockedCourseIds, []);
assert.deepEqual(reloaded.droppedIds, ["a"]);
assert.equal(reloaded.constraints.maxCredits, 16);

// Corrupt saved data falls back to defaults
data[STORAGE_KEYS.GOAL_CONSTRAINTS]["Spring 2027"] = { maxCredits: "lots", stray: true };
assert.deepEqual((await loadConstraints("Spring 2027", courses)).constraints, extensionDefaultConstraints());

// Counters
assert.deepEqual(await getCounters(), {
	goalProposals: 0,
	goalConfirmed: 0,
	goalDiscarded: 0,
	searchRuns: 0,
	searchTruncated: 0,
});
await incrementCounter("searchRuns");
await incrementCounter("searchRuns");
await incrementCounter("goalConfirmed");
assert.equal((await getCounters()).searchRuns, 2);
assert.equal((await getCounters()).goalConfirmed, 1);
await assert.rejects(incrementCounter("pageViews"), /Unknown counter/);
await resetCounters();
assert.equal((await getCounters()).searchRuns, 0);

console.log("Planning storage tests passed: term keys, per-term rules, stale IDs, counters");
