// Course metadata drawer: open/close and render its content.

import {
	clearActiveMetadataCourse,
	getActiveMetadataCourseId,
	getActiveMetadataFocusComponent,
	getCachedPlannedSchedule,
	getCourseById,
	getCurrentBuckets,
	getMetadataDrawerBody,
	getProfessorRatings,
	hasCourse,
	isPlannerCourseSelected,
	reloadSchedule,
	setActiveMetadataCourse,
	setMetadataDrawerInert,
} from "./runtime.js";
import { assignCourseToBucket } from "../storage/course-storage.js";
import { renderCourseMetadataContent } from "../metadata/course-metadata-panel.js";
import { findConflicts } from "../shared/calendar-utils.js";
import { isCourseOnline } from "./colors.js";
import { showToast } from "./ui-feedback.js";
import { cancelInlineRename } from "./bucket-actions.js";

export function closeCourseMetadataDrawer() {
	clearActiveMetadataCourse();
	document.body.classList.remove("metadata-drawer-open");
	setMetadataDrawerInert(true);
}

function buildCourseContext(course) {
	const isPlanned = isPlannerCourseSelected(course.id);
	const online = isCourseOnline(course);

	const scheduledDays = [];
	if (isPlanned && course.components) {
		for (const comp of course.components) {
			if (comp.timeRange && comp.days?.length) {
				for (const day of comp.days) {
					if (!scheduledDays.includes(day)) scheduledDays.push(day);
				}
			}
		}
	}

	const conflictCodes = [];
	if (isPlanned) {
		const conflicts = findConflicts(course, getCachedPlannedSchedule());
		const seen = new Set();
		for (const c of conflicts) {
			const other = getCourseById(c.existingCourse);
			if (other && !seen.has(other.courseCode)) {
				conflictCodes.push(other.courseCode);
				seen.add(other.courseCode);
			}
		}
	}

	const missingTypes = [];
	if (course.components?.length > 1) {
		for (const comp of course.components) {
			if (!comp.timeRange || !comp.days?.length) {
				const t = comp.type || "Section";
				if (!missingTypes.includes(t)) missingTypes.push(t);
			}
		}
	}

	return { isPlanned, online, scheduledDays, conflictCodes, missingTypes };
}

export function renderCourseMetadataDrawer() {
	const drawerBody = getMetadataDrawerBody();
	const activeCourseId = getActiveMetadataCourseId();
	if (!drawerBody || !activeCourseId) {
		return;
	}

	const course = getCourseById(activeCourseId);
	if (!course) {
		closeCourseMetadataDrawer();
		return;
	}

	const focusComponent = getActiveMetadataFocusComponent(course);

	renderCourseMetadataContent({
		container: drawerBody,
		course,
		buckets: getCurrentBuckets(),
		context: buildCourseContext(course),
		ratings: getProfessorRatings(),
		focusComponent,
		onBucketSelect: async (bucketId) => {
			if ((course.bucket ?? null) === (bucketId ?? null)) {
				return;
			}
			await assignCourseToBucket(course.id, bucketId);
			showToast(
				bucketId ? "Course bucket updated" : "Course moved to Unsorted",
				"success",
			);
			await reloadSchedule();
		},
	});
}

export function openCourseMetadataDrawer(courseId, focusComponent = null) {
	if (!courseId) return;
	cancelInlineRename();
	setActiveMetadataCourse(courseId, focusComponent);
	renderCourseMetadataDrawer();
	if (!hasCourse(courseId)) {
		return;
	}
	document.body.classList.add("metadata-drawer-open");
	setMetadataDrawerInert(false);
}
