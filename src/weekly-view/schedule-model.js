import { flattenToSchedule } from "../planner/planner.js";
import {
	calculateWeeklyHours,
	findConflicts,
	getEarliestStart,
	getLatestEnd,
} from "../shared/calendar-utils.js";
import { buildConflictColorMap } from "./colors.js";

function calculatePlannerConflicts(plannedCourses, plannedSchedule, coursesById) {
	const conflicts = [];
	const conflictCourseIds = new Set();

	for (const course of plannedCourses) {
		const courseConflicts = findConflicts(course, plannedSchedule);
		if (!courseConflicts.length) {
			continue;
		}

		const conflictingIds = new Set();
		for (const conflict of courseConflicts) {
			conflictingIds.add(conflict.existingCourse);
			conflictCourseIds.add(conflict.existingCourse);
		}
		conflictCourseIds.add(course.id);

		const conflictsWith = Array.from(conflictingIds)
			.map((id) => coursesById.get(id))
			.filter(Boolean);
		if (conflictsWith.length) {
			conflicts.push({ course, conflictsWith });
		}
	}

	return { conflicts, conflictCourseIds };
}

function checkIncompleteScheduling(plannedCourses) {
	const warnings = [];
	for (const course of plannedCourses) {
		if (!course.components || course.components.length <= 1) continue;

		const withTime = [];
		const withoutTime = [];
		for (const component of course.components) {
			if (component.timeRange && component.days && component.days.length > 0) {
				withTime.push(component);
			} else {
				withoutTime.push(component);
			}
		}

		if (withTime.length > 0 && withoutTime.length > 0) {
			const missingTypes = [
				...new Set(withoutTime.map((component) => component.type || "Section")),
			];
			warnings.push({ course, missingTypes });
		}
	}
	return warnings;
}

export function createWeeklyScheduleModel({
	courses,
	buckets,
	plannerSelection,
}) {
	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const plannerSelectionSet = new Set(plannerSelection);
	const plannedCourses = courses.filter((course) =>
		plannerSelectionSet.has(course.id),
	);
	const plannedSchedule = flattenToSchedule(plannedCourses);
	const { conflicts, conflictCourseIds } = calculatePlannerConflicts(
		plannedCourses,
		plannedSchedule,
		coursesById,
	);

	return {
		courses,
		buckets,
		coursesById,
		plannerSelectionSet,
		plannedCourses,
		plannedSchedule,
		conflicts,
		conflictCourseIds,
		conflictColorMap: buildConflictColorMap(conflictCourseIds),
		incompleteWarnings: checkIncompleteScheduling(plannedCourses),
		stats: {
			totalCourses: plannedCourses.length,
			totalCredits: plannedCourses.reduce(
				(sum, course) => sum + (course.credits || 0),
				0,
			),
			weeklyHours: calculateWeeklyHours(plannedSchedule),
			earliestStart: getEarliestStart(plannedSchedule),
			latestEnd: getLatestEnd(plannedSchedule),
		},
	};
}
