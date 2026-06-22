// Hover-to-locate: hovering a sidebar course card (planner chip or bucket entry)
// highlights that course's existing blocks on the calendar and dims the rest.
// Does nothing for courses that aren't on the calendar.

import {
	getCalendarGrid,
	getWeeklySidebar,
	isDraggingCourse,
} from "./runtime.js";

let activeCourseId = null;

function clearHighlight() {
	const grid = getCalendarGrid();
	if (!grid) return;
	grid.classList.remove("has-hover-highlight");
	for (const block of grid.querySelectorAll(
		".course-block.is-hover-highlight",
	)) {
		block.classList.remove("is-hover-highlight");
	}
	activeCourseId = null;
}

function highlight(courseId) {
	if (courseId === activeCourseId) return;
	clearHighlight();
	// Don't fight an in-progress drag preview.
	const grid = getCalendarGrid();
	if (isDraggingCourse() || !grid) return;

	const blocks = grid.querySelectorAll(
		`.course-block[data-course-id="${CSS.escape(courseId)}"]`,
	);
	if (blocks.length === 0) return; // course isn't on the calendar — no preview

	for (const block of blocks) block.classList.add("is-hover-highlight");
	grid.classList.add("has-hover-highlight");
	activeCourseId = courseId;
}

export function setupHoverHighlight() {
	const sidebar = getWeeklySidebar();
	if (!sidebar) return;

	sidebar.addEventListener("mouseover", (event) => {
		const card = event.target.closest("[data-course-id]");
		if (!card || !sidebar.contains(card)) {
			clearHighlight();
			return;
		}
		highlight(card.dataset.courseId);
	});

	// Leaving the sidebar entirely tears the preview down.
	sidebar.addEventListener("mouseleave", clearHighlight);
}
