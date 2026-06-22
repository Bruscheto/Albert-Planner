// Render the planned schedule as positioned blocks on the calendar grid.

import {
	didCourseBlockDragEndRecently,
	getProfessorRating,
	setCalendarEmptyStateVisible,
} from "./runtime.js";
import { START_HOUR, HOUR_HEIGHT } from "./config.js";
import { courseCodeToColor, isComponentOnline } from "./colors.js";
import { layoutEventsForDay } from "./layout.js";
import { formatTime, timeToMinutes } from "../shared/time-parser.js";
import { ratingTier } from "../metadata/course-metadata-panel.js";
import { handleCourseDragStart, handleCourseDragEnd } from "./drag-drop.js";
import { openCourseMetadataDrawer } from "./metadata-drawer.js";
import { handlePlannerRemove } from "./bucket-actions.js";

export function renderCourseBlocks(schedule, buckets, options = {}) {
	const bucketDetails = {};
	const {
		highlightConflicts = false,
		conflictCourseIds = new Set(),
		conflictColorMap = new Map(),
	} = options;
	for (const bucket of buckets) {
		bucketDetails[bucket.id] = bucket;
	}

	// Group by day
	const eventsByDay = {};
	for (const component of schedule) {
		if (!component.timeRange || component.days.length === 0) continue;
		for (const day of component.days) {
			if (!eventsByDay[day]) eventsByDay[day] = [];
			eventsByDay[day].push(component);
		}
	}

	// Render for each day
	for (const day of Object.keys(eventsByDay)) {
		const slotsContainer = document.getElementById(`slots-${day}`);
		if (!slotsContainer) continue;

		const events = eventsByDay[day];
		const layout = layoutEventsForDay(events);

		for (let i = 0; i < events.length; i++) {
			const component = events[i];
			const { left, width } = layout[i];

			const isConflictCourse =
				highlightConflicts && conflictCourseIds.has(component.courseId);

			const block = createCourseBlock(component, bucketDetails, {
				isConflict: isConflictCourse,
				conflictColorMap,
				left: `${left}%`,
				width: `${width}%`,
			});
			slotsContainer.appendChild(block);
		}
	}
}

function createCourseBlock(component, bucketDetails, options = {}) {
	const {
		isConflict = false,
		conflictColorMap = new Map(),
		left = "0%",
		width = "100%",
	} = options;
	const block = document.createElement("div");
	block.className = "course-block";
	if (isConflict) {
		block.classList.add("conflict");
	}
	block.draggable = true;
	block.dataset.courseId = component.courseId;
	block.dataset.bucketId = component.bucket ?? "";
	block.tabIndex = 0;
	block.setAttribute("role", "button");
	block.setAttribute("aria-label", `Open metadata for ${component.courseCode}`);
	block.addEventListener("dragstart", handleCourseDragStart);
	block.addEventListener("dragend", handleCourseDragEnd);

	const startMinutes = timeToMinutes(component.timeRange.start);
	const endMinutes = timeToMinutes(component.timeRange.end);
	const startOffset = startMinutes - START_HOUR * 60;
	const duration = endMinutes - startMinutes;

	block.style.top = `${(startOffset / 60) * HOUR_HEIGHT}px`;
	block.style.height = `${(duration / 60) * HOUR_HEIGHT}px`;
	block.style.left = left;
	block.style.width = width;

	// Compact mode for short classes — hide title, keep code + time + tags
	if (duration <= 55) {
		block.classList.add("is-compact");
	}

	const bucketInfo = component.bucket ? bucketDetails[component.bucket] : null;
	if (bucketInfo?.color) {
		block.classList.add("has-bucket-accent");
		block.style.setProperty("--bucket-accent", bucketInfo.color);
	}
	const color = courseCodeToColor(component.courseCode);
	if (!isConflict) {
		block.style.backgroundColor = color;
	} else {
		const conflictColor = conflictColorMap.get(component.courseId);
		if (conflictColor) {
			block.style.setProperty("--conflict-fill", conflictColor.fill);
			block.style.setProperty("--conflict-border", conflictColor.border);
		}
	}

	const startStr = formatTime(component.timeRange.start);
	const endStr = formatTime(component.timeRange.end);
	const online = isComponentOnline(component);
	if (online) block.classList.add("is-online");
	const isRecitation = component.type === "Recitation";
	const typeLabel =
		isRecitation ? "reci." : component.type;
	const typePill =
		component.type && component.type !== "Lecture"
			? `<span class="course-block-pill type${isRecitation ? " type-recitation" : ""}">${typeLabel}</span>`
			: "";

	let ratingPill = "";
	const profName = component.instructor?.trim();
	const professorRating = profName ? getProfessorRating(profName) : null;
	if (
		profName &&
		!/^(TBA|to be announced)$/i.test(profName) &&
		professorRating != null
	) {
		const num = Number(professorRating);
		const r = num.toFixed(1);
		const tier = ratingTier(num);
		ratingPill = `<span class="course-block-pill rating rating-${tier}">${r}</span>`;
	}

	const pillContent = `${typePill}${ratingPill}`;
	const allPills = pillContent
		? `<div class="course-block-tags">${pillContent}</div>`
		: "";
	const conflictMarker =
		'<button type="button" class="course-block-remove-btn" aria-label="Remove course from schedule" title="Remove from schedule"><svg class="course-block-remove-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
	block.innerHTML = `
    ${conflictMarker}
    <div class="course-block-code">${component.courseCode}</div>
    <div class="course-block-time">${startStr} - ${endStr}</div>
    <div class="course-block-title">${component.courseTitle || ""}</div>
    ${allPills}
  `;

	const removeButton = block.querySelector(".course-block-remove-btn");

	if (removeButton) {
		removeButton.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});

		removeButton.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await handlePlannerRemove(component.courseId);
		});
	}

	block.addEventListener("click", (event) => {
		if (event.target.closest(".course-block-remove-btn")) {
			return;
		}
		if (didCourseBlockDragEndRecently()) {
			return;
		}
		openCourseMetadataDrawer(component.courseId, component);
	});

	block.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openCourseMetadataDrawer(component.courseId, component);
		}
	});

	block.title =
		`${component.courseCode} - ${component.courseTitle}\n` +
		`${component.type}\n` +
		`${startStr} - ${endStr}\n` +
		`${component.room}\n` +
		`${component.instructor}`;

	return block;
}

export function clearCourseBlocks() {
	const blocks = document.querySelectorAll(".course-block");
	blocks.forEach((block) => block.remove());
}

export function toggleCalendarEmptyState(isEmpty) {
	setCalendarEmptyStateVisible(isEmpty);
}
