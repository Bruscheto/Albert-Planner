// Constants and configuration for Albert Course Planner

// Day abbreviation mapping - Albert uses 2-letter codes: Mo, Tu, We, Th, Fr, Sa, Su
export const DAY_MAP = {
	Mo: "Mon",
	Tu: "Tue",
	We: "Wed",
	Th: "Thu",
	Fr: "Fri",
	Sa: "Sat",
	Su: "Sun",
};

export const DAY_ABBREVS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export const DEFAULT_BUCKETS = [
	{ id: "required", name: "Required", color: "#f97316", priority: 1 },
	{ id: "high", name: "High Priority", color: "#3b82f6", priority: 2 },
	{ id: "medium", name: "Medium Priority", color: "#eab308", priority: 3 },
	{ id: "low", name: "Low Priority", color: "#22c55e", priority: 4 },
	{ id: "backup", name: "Backup", color: "#6b7280", priority: 5 },
];

export const STORAGE_KEYS = {
	COURSES: "courses",
	BUCKETS: "buckets",
	REQUIREMENTS: "requirements",
	SETTINGS: "settings",
	PLANNER_SELECTION: "plannerSelection",
	PROFESSOR_RATINGS: "professorRatings",
};

// New Albert page structure selectors
export const SELECTORS = {
	// The main cart table with title containing "Shopping Cart"
	CART_TABLE: 'table.ps_grid-flex[title*="Shopping Cart"]',
	// Each row in the cart
	CART_ROW: "tr.ps_grid-row",
	// Inside each row, the layout container
	LAYOUT: "div.ps_box-group.psc_layout",
};

export const CALENDAR_CONFIG = {
	START_HOUR: 8,
	END_HOUR: 22,
	INTERVAL_MINUTES: 30,
};
