// Hover-to-locate: hovering a sidebar course card (planner chip or bucket entry)
// highlights that course's existing blocks on the calendar and dims the rest.
// Does nothing for courses that aren't on the calendar.

import { state, dom } from "./context.js";

let activeCourseId = null;

function clearHighlight() {
	if (!dom.calendarGrid) return;
	dom.calendarGrid.classList.remove("has-hover-highlight");
	for (const block of dom.calendarGrid.querySelectorAll(
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
	if (state.draggedCourseId || !dom.calendarGrid) return;

	const blocks = dom.calendarGrid.querySelectorAll(
		`.course-block[data-course-id="${CSS.escape(courseId)}"]`,
	);
	if (blocks.length === 0) return; // course isn't on the calendar — no preview

	for (const block of blocks) block.classList.add("is-hover-highlight");
	dom.calendarGrid.classList.add("has-hover-highlight");
	activeCourseId = courseId;
}

export function setupHoverHighlight() {
	const sidebar = dom.weeklySidebar;
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
