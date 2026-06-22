// Drag-and-drop between buckets and the calendar, plus the drag preview.

import {
	addDragPreviewGhost,
	attachDragPreviewCursorHandler,
	clearDragPayload,
	clearDragPreviewArtifacts,
	getCachedPlannedSchedule,
	getCalendarGrid,
	getCourseById,
	getDragPayload,
	getDraggedCourseId,
	isPlannerCourseSelected,
	markCourseBlockDragEnded,
	moveDragPreviewPill,
	reloadSchedule,
	setDragPayload,
	setDragPreviewPill,
} from "./runtime.js";
import { START_HOUR, HOUR_HEIGHT } from "./config.js";
import { courseCodeToColor } from "./colors.js";
import { formatTime, timeToMinutes } from "../shared/time-parser.js";
import { hasConflict } from "../shared/calendar-utils.js";
import {
	assignCourseToBucket,
	addCourseToPlannerSelection,
} from "../storage/course-storage.js";
import { showToast } from "./ui-feedback.js";

export function handleCourseDragStart(event) {
	const courseId = event.currentTarget?.dataset?.courseId;
	if (!courseId) return;
	setDragPayload({
		courseId,
		source: "calendar",
		fromBucketId: event.currentTarget?.dataset?.bucketId || null,
	});
	event.dataTransfer?.setData("text/plain", courseId);
	event.dataTransfer.effectAllowed = "move";
	setCalendarCourseDragState(courseId, true);
}

export function handleCourseDragEnd(event) {
	const courseId = event.currentTarget?.dataset?.courseId || getDraggedCourseId();
	if (courseId) {
		setCalendarCourseDragState(courseId, false);
	}
	markCourseBlockDragEnded();
	resetDragPayload();
}

export function handleBucketCourseDragStart(event) {
	const handle = event.currentTarget;
	const entry = handle.closest(".bucket-course-entry");
	const courseId = handle?.dataset?.courseId || entry?.dataset?.courseId;
	if (!courseId) return;
	setDragPayload({
		courseId,
		source: "bucket",
		fromBucketId: handle?.dataset?.bucketId || entry?.dataset?.bucketId || null,
	});
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
	const dragPayload = getDragPayload();
	if (!wrapper || !dragPayload.courseId) return;

	const bucketKey = wrapper.dataset.bucketId;
	const bucketId = bucketKey === "unsorted" ? null : bucketKey;

	// Prevent dropping into source bucket
	const isValidTarget =
		dragPayload.source === "calendar" ||
		(dragPayload.source === "bucket" && dragPayload.fromBucketId !== bucketId);

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
	const dragPayload = getDragPayload();
	if (!dragPayload.courseId) {
		resetDragPayload();
		return;
	}

	if (dragPayload.source === "calendar") {
		if (bucketId !== dragPayload.fromBucketId) {
			await assignCourseToBucket(dragPayload.courseId, bucketId || null);
		}
	} else if (
		dragPayload.source === "bucket" &&
		bucketId !== dragPayload.fromBucketId
	) {
		await assignCourseToBucket(dragPayload.courseId, bucketId || null);
	}

	resetDragPayload();
	await reloadSchedule();
}

export function handleCalendarDragEnter(event) {
	if (getDragPayload().source !== "bucket") return;
	event.preventDefault();
	getCalendarGrid()?.classList.add("drag-over");
}

export function handleCalendarDragOver(event) {
	if (getDragPayload().source !== "bucket") return;
	event.preventDefault();
	event.dataTransfer.dropEffect = "move";
}

export function handleCalendarDragLeave(event) {
	const nextTarget = event.relatedTarget;
	const calendarGrid = getCalendarGrid();
	if (!nextTarget || !calendarGrid?.contains(nextTarget)) {
		calendarGrid?.classList.remove("drag-over");
	}
}

export async function handleCalendarDrop(event) {
	event.preventDefault();
	getCalendarGrid()?.classList.remove("drag-over");
	hideDragPreview();

	// Try to get course ID from global state or dataTransfer
	const dragPayload = getDragPayload();
	let courseId = dragPayload.courseId;
	if (!courseId) {
		courseId = event.dataTransfer.getData("text/plain");
	}

	if (!courseId) {
		resetDragPayload();
		return;
	}

	// If dragging from bucket or if we have a valid course ID that isn't in planner yet
	if (
		(dragPayload.source === "bucket" || courseId) &&
		!isPlannerCourseSelected(courseId)
	) {
		await addCourseToPlannerSelection(courseId);
		showToast("Course added to schedule", "success");
		await reloadSchedule();
	} else if (isPlannerCourseSelected(courseId)) {
		showToast("Course is already in schedule", "info");
	}

	resetDragPayload();
}

function resetDragPayload() {
	const targets = document.querySelectorAll(".is-drop-target");
	targets.forEach((el) => el.classList.remove("is-drop-target"));
	document
		.querySelectorAll(".course-block.dragging")
		.forEach((block) => block.classList.remove("dragging"));
	getCalendarGrid()?.classList.remove("drag-over");
	clearDragPayload();
}

function setCalendarCourseDragState(courseId, isDragging) {
	const selector = `.course-block[data-course-id="${CSS.escape(courseId)}"]`;
	for (const block of document.querySelectorAll(selector)) {
		block.classList.toggle("dragging", isDragging);
	}
}

function showDragPreview(courseId) {
	hideDragPreview();
	const course = getCourseById(courseId);
	if (!course || !Array.isArray(course.components)) return;

	const alreadyAdded = isPlannerCourseSelected(courseId);
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
			!alreadyAdded && hasConflict(component, getCachedPlannedSchedule());
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

			const typeLabel =
				component.type === "Recitation"
					? "RECI."
					: (component.type || "Class").toUpperCase();
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
			addDragPreviewGhost(ghost);
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
	setDragPreviewPill(pill);
	document.body.classList.add("is-drag-preview-active");

	const cursorHandler = (e) => {
		moveDragPreviewPill(e.clientX, e.clientY);
	};
	attachDragPreviewCursorHandler(cursorHandler);
}

function hideDragPreview() {
	clearDragPreviewArtifacts();
}
