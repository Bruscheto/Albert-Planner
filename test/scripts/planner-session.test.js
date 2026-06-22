import assert from "node:assert/strict";
import {
	getTermBadgeLabel,
	hasPlannerSessionChange,
	loadPlannerSession,
} from "../../src/planner/session.js";
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
		},
	};
}

function course(id, termName) {
	return {
		id,
		courseCode: id.toUpperCase(),
		section: "001",
		title: `${id} title`,
		credits: 4,
		components: [],
		term: termName ? { name: termName } : null,
	};
}

assert.equal(getTermBadgeLabel([course("a", "Fall 2026")]), "Fall 2026");
assert.equal(
	getTermBadgeLabel([course("a", "Fall 2026"), course("b", "Spring 2027")]),
	"2 terms",
);
assert.equal(
	getTermBadgeLabel([], { name: "Summer 2026" }),
	"Summer 2026",
);
assert.equal(getTermBadgeLabel([], null), "schedule");

assert.equal(hasPlannerSessionChange({ courses: {} }), true);
assert.equal(hasPlannerSessionChange({ buckets: {} }), true);
assert.equal(hasPlannerSessionChange({ plannerSelection: {} }), true);
assert.equal(hasPlannerSessionChange({ professorRatings: {} }), true);
assert.equal(hasPlannerSessionChange({ activeTerm: {} }), true);
assert.equal(hasPlannerSessionChange({ settings: {} }), false);

globalThis.chrome = {
	storage: createChromeStorage({
		[STORAGE_KEYS.COURSES]: [course("a", "Fall 2026")],
		[STORAGE_KEYS.BUCKETS]: [
			{ id: "required", name: "Required", color: "#fff", priority: 1 },
		],
		[STORAGE_KEYS.PLANNER_SELECTION]: ["a"],
		[STORAGE_KEYS.PROFESSOR_RATINGS]: { Ada: 4.8 },
		[STORAGE_KEYS.ACTIVE_TERM]: { name: "Fall 2026" },
	}),
};

const session = await loadPlannerSession();
assert.equal(session.courses[0].id, "a");
assert.equal(session.buckets[0].id, "required");
assert.deepEqual(session.plannerSelection, ["a"]);
assert.deepEqual(session.professorRatings, { Ada: 4.8 });
assert.deepEqual(session.activeTerm, { name: "Fall 2026" });
assert.equal(session.termBadgeLabel, "Fall 2026");

console.log("Planner session tests passed");
