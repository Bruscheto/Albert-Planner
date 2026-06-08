// Color helpers for the weekly view (pure, no shared state).

export const CONFLICT_COLOR_PALETTE = [
	{ fill: "#c41e3a", border: "#a71931" },
	{ fill: "#dc143c", border: "#bb1133" },
	{ fill: "#b22222", border: "#971d1d" },
	{ fill: "#e63946", border: "#c4303c" },
	{ fill: "#a4161a", border: "#8b1316" },
	{ fill: "#d32f2f", border: "#b32828" },
];

export function buildConflictColorMap(conflictCourseIds) {
	const orderedIds = Array.from(conflictCourseIds).sort((a, b) =>
		String(a).localeCompare(String(b)),
	);
	const map = new Map();
	orderedIds.forEach((courseId, index) => {
		map.set(
			courseId,
			CONFLICT_COLOR_PALETTE[index % CONFLICT_COLOR_PALETTE.length],
		);
	});
	return map;
}

/**
 * Deterministic low-saturation color from a course code string.
 * Same courseCode (regardless of section) always produces the same hue.
 */
export function courseCodeToColor(courseCode) {
	let hash = 0;
	for (let i = 0; i < courseCode.length; i++) {
		hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
		hash |= 0;
	}
	const hue = ((hash % 360) + 360) % 360;
	return `hsl(${hue}, 42%, 56%)`;
}

export function isComponentOnline(component) {
	if (!component?.room) return false;
	return /\bonline\b/i.test(component.room);
}

export function isCourseOnline(course) {
	return course?.components?.some(isComponentOnline) ?? false;
}
