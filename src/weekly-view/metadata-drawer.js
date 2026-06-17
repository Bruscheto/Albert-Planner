// Course metadata drawer: open/close and render its content.

import { state, dom } from "./context.js";
import { assignCourseToBucket } from "../course-storage.js";
import { renderCourseMetadataContent } from "../course-metadata-panel.js";
import { findConflicts } from "../utils/calendar-utils.js";
import { isCourseOnline } from "./colors.js";
import { showToast } from "./ui-feedback.js";
import { cancelInlineRename } from "./bucket-actions.js";

export function closeCourseMetadataDrawer() {
	state.activeMetadataCourseId = null;
	state.activeMetadataComponentSection = null;
	state.activeMetadataComponentType = null;
	document.body.classList.remove("metadata-drawer-open");
	dom.metadataDrawer?.setAttribute("aria-hidden", "true");
}

function buildCourseContext(course) {
	const isPlanned = state.plannerSelectionSet.has(course.id);
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
		const conflicts = findConflicts(course, state.cachedPlannedSchedule);
		const seen = new Set();
		for (const c of conflicts) {
			const other = state.coursesById.get(c.existingCourse);
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
	if (!dom.metadataDrawerBody || !state.activeMetadataCourseId) {
		return;
	}

	const course = state.coursesById.get(state.activeMetadataCourseId);
	if (!course) {
		closeCourseMetadataDrawer();
		return;
	}

	const focusComponent = state.activeMetadataComponentSection
		? course.components?.find(
				(component) =>
					component.section === state.activeMetadataComponentSection &&
					component.type === state.activeMetadataComponentType,
			) || null
		: null;

	renderCourseMetadataContent({
		container: dom.metadataDrawerBody,
		course,
		buckets: state.currentBuckets,
		context: buildCourseContext(course),
		ratings: state.cachedProfRatings,
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
			await state.reload();
		},
	});
}

export function openCourseMetadataDrawer(courseId, focusComponent = null) {
	if (!courseId) return;
	cancelInlineRename();
	state.activeMetadataCourseId = courseId;
	state.activeMetadataComponentSection = focusComponent?.section ?? null;
	state.activeMetadataComponentType = focusComponent?.type ?? null;
	renderCourseMetadataDrawer();
	if (!state.coursesById.has(courseId)) {
		return;
	}
	document.body.classList.add("metadata-drawer-open");
	dom.metadataDrawer?.setAttribute("aria-hidden", "false");
}
