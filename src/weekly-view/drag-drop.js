// Drag-and-drop between buckets and the calendar, plus the drag preview.

import { state, dom } from "./context.js";
import { START_HOUR, HOUR_HEIGHT } from "./config.js";
import { courseCodeToColor } from "./colors.js";
import { formatTime, timeToMinutes } from "../utils/time-parser.js";
import { hasConflict } from "../utils/calendar-utils.js";
import {
	assignCourseToBucket,
	addCourseToPlannerSelection,
	removeCourseFromPlannerSelection,
} from "../course-storage.js";
import { showToast } from "./ui-feedback.js";

export function handleCourseDragStart(event) {
	const courseId = event.currentTarget?.dataset?.courseId;
	if (!courseId) return;
	state.draggedCourseId = courseId;
	state.draggedSource = "calendar";
	state.draggedFromBucketId = event.currentTarget?.dataset?.bucketId || null;
	event.dataTransfer?.setData("text/plain", courseId);
	event.dataTransfer.effectAllowed = "move";
	event.currentTarget.classList.add("dragging");
}

export function handleCourseDragEnd(event) {
	event.currentTarget.classList.remove("dragging");
	state.lastCourseBlockDragEndedAt = Date.now();
	resetDragPayload();
}

export function handleBucketCourseDragStart(event) {
	const handle = event.currentTarget;
	const entry = handle.closest(".bucket-course-entry");
	const courseId = handle?.dataset?.courseId || entry?.dataset?.courseId;
	if (!courseId) return;
	state.draggedCourseId = courseId;
	state.draggedSource = "bucket";
	state.draggedFromBucketId =
		handle?.dataset?.bucketId || entry?.dataset?.bucketId || null;
	event.dataTransfer?.setData("text/plain", courseId);
	event.dataTransfer.effectAllowed = "copyMove";
	entry?.classList.add("is-dragging");
	showDragPreview(courseId);
}

export function handleBucketCourseDragEnd(event) {
	const entry = event.currentTarget.closest(".bucket-course-entry");
	entry?.classList.remove("is-dragging");
	hideDragPreview();
	resetDragPayload();
}

export function handleBucketWrapperDragOver(event) {
	const wrapper = event.currentTarget;
	if (!wrapper || !state.draggedCourseId) return;

	const bucketKey = wrapper.dataset.bucketId;
	const bucketId = bucketKey === "unsorted" ? null : bucketKey;

	// Prevent dropping into source bucket
	const isValidTarget =
		state.draggedSource === "calendar" ||
		(state.draggedSource === "bucket" && state.draggedFromBucketId !== bucketId);

	if (!isValidTarget) return;

	event.preventDefault();
	event.dataTransfer.dropEffect = "move";
	wrapper.classList.add("is-drop-target");
}

export function handleBucketWrapperDragLeave(event) {
	const wrapper = event.currentTarget;
	if (!wrapper) return;

	const nextTarget = event.relatedTarget;
	if (!nextTarget || !wrapper.contains(nextTarget)) {
		wrapper.classList.remove("is-drop-target");
	}
}

export async function handleBucketWrapperDrop(event) {
	const wrapper = event.currentTarget;
	if (!wrapper) {
		resetDragPayload();
		return;
	}
	event.preventDefault();
	wrapper.classList.remove("is-drop-target");

	const bucketKey = wrapper.dataset.bucketId;
	const bucketId = bucketKey === "unsorted" ? null : bucketKey;

	await completeBucketDrop(bucketId);
}

async function completeBucketDrop(bucketId) {
	if (!state.draggedCourseId) {
		resetDragPayload();
		return;
	}

	if (state.draggedSource === "calendar") {
		if (bucketId !== state.draggedFromBucketId) {
			await assignCourseToBucket(state.draggedCourseId, bucketId || null);
		}
		await removeCourseFromPlannerSelection(state.draggedCourseId);
	} else if (
		state.draggedSource === "bucket" &&
		bucketId !== state.draggedFromBucketId
	) {
		await assignCourseToBucket(state.draggedCourseId, bucketId || null);
	}

	resetDragPayload();
	await state.reload();
}

export function handleCalendarDragEnter(event) {
	if (state.draggedSource !== "bucket") return;
	event.preventDefault();
	dom.calendarGrid.classList.add("drag-over");
}

export function handleCalendarDragOver(event) {
	if (state.draggedSource !== "bucket") return;
	event.preventDefault();
	event.dataTransfer.dropEffect = "move";
}

export function handleCalendarDragLeave(event) {
	const nextTarget = event.relatedTarget;
	if (!nextTarget || !dom.calendarGrid.contains(nextTarget)) {
		dom.calendarGrid.classList.remove("drag-over");
	}
}

export async function handleCalendarDrop(event) {
	event.preventDefault();
	dom.calendarGrid?.classList.remove("drag-over");
	hideDragPreview();

	// Try to get course ID from global state or dataTransfer
	let courseId = state.draggedCourseId;
	if (!courseId) {
		courseId = event.dataTransfer.getData("text/plain");
	}

	if (!courseId) {
		resetDragPayload();
		return;
	}

	// If dragging from bucket or if we have a valid course ID that isn't in planner yet
	if (
		(state.draggedSource === "bucket" || courseId) &&
		!state.plannerSelectionSet.has(courseId)
	) {
		await addCourseToPlannerSelection(courseId);
		showToast("Course added to schedule", "success");
		await state.reload();
	} else if (state.plannerSelectionSet.has(courseId)) {
		showToast("Course is already in schedule", "info");
	}

	resetDragPayload();
}

function resetDragPayload() {
	const targets = document.querySelectorAll(".is-drop-target");
	targets.forEach((el) => el.classList.remove("is-drop-target"));
	dom.calendarGrid?.classList.remove("drag-over");
	state.draggedCourseId = null;
	state.draggedSource = null;
	state.draggedFromBucketId = null;
}

function showDragPreview(courseId) {
	hideDragPreview();
	const course = state.coursesById.get(courseId);
	if (!course || !Array.isArray(course.components)) return;

	const alreadyAdded = state.plannerSelectionSet.has(courseId);
	const accentColor = courseCodeToColor(course.courseCode || course.id);
	let totalSlots = 0;
	let conflictSlots = 0;
	const componentSummaries = [];

	for (const component of course.components) {
		if (!component.timeRange || !component.days?.length) continue;

		const startMinutes = timeToMinutes(component.timeRange.start);
		const endMinutes = timeToMinutes(component.timeRange.end);
		if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;

		const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
		const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

		const componentConflicts =
			!alreadyAdded && hasConflict(component, state.cachedPlannedSchedule);
		componentSummaries.push({
			type: component.type || "Class",
			days: component.days.join("/"),
			start: formatTime(component.timeRange.start),
			end: formatTime(component.timeRange.end),
			conflict: componentConflicts,
		});

		if (alreadyAdded) continue;

		for (const day of component.days) {
			const slotsContainer = document.getElementById(`slots-${day}`);
			if (!slotsContainer) continue;
			totalSlots++;
			if (componentConflicts) conflictSlots++;

			const ghost = document.createElement("div");
			ghost.className = "course-block-ghost";
			if (componentConflicts) ghost.classList.add("is-conflict");
			ghost.style.top = `${top}px`;
			ghost.style.height = `${Math.max(height, 18)}px`;
			ghost.style.setProperty("--ghost-accent", accentColor);

			const typeLabel = (component.type || "Class").toUpperCase();
			const timeLabel = `${formatTime(component.timeRange.start)} – ${formatTime(component.timeRange.end)}`;
			ghost.innerHTML = `
				<div class="course-block-ghost-head">
					<span class="course-block-ghost-code">${course.courseCode || ""}</span>
					<span class="course-block-ghost-type">${typeLabel}</span>
				</div>
				<div class="course-block-ghost-time">${timeLabel}</div>
				${componentConflicts ? '<span class="course-block-ghost-mark" aria-hidden="true">✕</span>' : ""}
			`;
			slotsContainer.appendChild(ghost);
			state.dragPreviewGhosts.push(ghost);
		}
	}

	const pill = document.createElement("div");
	pill.className = "drag-cursor-pill";
	if (alreadyAdded) {
		pill.classList.add("is-added");
	} else {
		pill.classList.add(conflictSlots > 0 ? "is-conflict" : "is-ok");
	}

	const metaHtml = componentSummaries
		.map(
			(c) =>
				`<div class="drag-cursor-pill-line${c.conflict ? " is-conflict" : ""}">
					<span class="drag-cursor-pill-type">${c.type}</span>
					<span class="drag-cursor-pill-when">${c.days} · ${c.start}–${c.end}</span>
				</div>`,
		)
		.join("");

	let statusLabel;
	let statusGlyph;
	if (alreadyAdded) {
		statusLabel = "already on calendar";
		statusGlyph = "●";
	} else if (conflictSlots > 0) {
		statusLabel = `${conflictSlots} conflict${conflictSlots > 1 ? "s" : ""}`;
		statusGlyph = "✕";
	} else {
		statusLabel = `${totalSlots || 0} slot${totalSlots === 1 ? "" : "s"} clear`;
		statusGlyph = "✓";
	}

	pill.innerHTML = `
		<div class="drag-cursor-pill-head">
			<span class="drag-cursor-pill-code">${course.courseCode || ""}</span>
			${course.title ? `<span class="drag-cursor-pill-title">${course.title}</span>` : ""}
		</div>
		${metaHtml ? `<div class="drag-cursor-pill-body">${metaHtml}</div>` : ""}
		<div class="drag-cursor-pill-status">
			<span class="drag-cursor-pill-glyph" aria-hidden="true">${statusGlyph}</span>
			<span>${statusLabel}</span>
		</div>
	`;
	document.body.appendChild(pill);
	state.dragPreviewPill = pill;
	document.body.classList.add("is-drag-preview-active");

	state.dragPreviewCursorHandler = (e) => {
		if (!state.dragPreviewPill) return;
		if (e.clientX === 0 && e.clientY === 0) return;
		state.dragPreviewPill.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 18}px, 0)`;
		if (!state.dragPreviewPill.classList.contains("is-visible")) {
			state.dragPreviewPill.classList.add("is-visible");
		}
	};
	document.addEventListener("dragover", state.dragPreviewCursorHandler);
}

function hideDragPreview() {
	for (const ghost of state.dragPreviewGhosts) ghost.remove();
	state.dragPreviewGhosts = [];
	if (state.dragPreviewPill) {
		state.dragPreviewPill.remove();
		state.dragPreviewPill = null;
	}
	if (state.dragPreviewCursorHandler) {
		document.removeEventListener("dragover", state.dragPreviewCursorHandler);
		state.dragPreviewCursorHandler = null;
	}
	document.body.classList.remove("is-drag-preview-active");
}
