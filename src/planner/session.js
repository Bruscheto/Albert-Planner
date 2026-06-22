import {
	getBuckets,
	getCourses,
	getPlannerSelection,
	getProfessorRatings,
} from "../storage/course-storage.js";
import { STORAGE_KEYS } from "../shared/constants.js";

const PLANNER_STORAGE_KEYS = Object.freeze([
	STORAGE_KEYS.COURSES,
	STORAGE_KEYS.BUCKETS,
	STORAGE_KEYS.PLANNER_SELECTION,
	STORAGE_KEYS.PROFESSOR_RATINGS,
	STORAGE_KEYS.ACTIVE_TERM,
]);

export function hasPlannerSessionChange(changes = {}) {
	return PLANNER_STORAGE_KEYS.some((key) =>
		Object.prototype.hasOwnProperty.call(changes, key),
	);
}

export function getTermBadgeLabel(courses, activeTerm = null) {
	const termNames = [
		...new Set(
			courses
				.map((course) => course?.term?.name)
				.filter((name) => typeof name === "string" && name.trim()),
		),
	];

	if (termNames.length === 1) return termNames[0];
	if (termNames.length > 1) return `${termNames.length} terms`;
	if (typeof activeTerm?.name === "string" && activeTerm.name.trim()) {
		return activeTerm.name;
	}
	return "schedule";
}

export async function loadPlannerSession() {
	const [courses, buckets, plannerSelection, professorRatings, termResult] =
		await Promise.all([
			getCourses(),
			getBuckets(),
			getPlannerSelection(),
			getProfessorRatings(),
			chrome.storage.local.get(STORAGE_KEYS.ACTIVE_TERM),
		]);
	const activeTerm = termResult[STORAGE_KEYS.ACTIVE_TERM] ?? null;

	return {
		courses,
		buckets,
		plannerSelection,
		professorRatings,
		activeTerm,
		termBadgeLabel: getTermBadgeLabel(courses, activeTerm),
	};
}
