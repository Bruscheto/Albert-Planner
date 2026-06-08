// Shared runtime state and DOM references for the weekly view.
//
// The weekly view is composed of several feature modules that all operate on
// the same mutable view state and the same set of DOM nodes. Centralizing them
// here keeps that state in one place instead of as module-level globals.

// Mutable view state. Feature modules read and write these fields directly.
export const state = {
	draggedCourseId: null,
	draggedSource: null,
	draggedFromBucketId: null,
	bucketCollapseState: new Map(),
	deleteMode: false,
	bucketsPendingDeletion: new Set(),
	activeRenameState: null,
	plannerSelectionSet: new Set(),
	coursesById: new Map(),
	currentBuckets: [],
	activeMetadataCourseId: null,
	lastCourseBlockDragEndedAt: 0,
	isSidebarOpen: true,
	cachedPlannedSchedule: [],
	dragPreviewGhosts: [],
	dragPreviewPill: null,
	dragPreviewCursorHandler: null,
	cachedProfRatings: {},
	skipDrawerRefresh: false,
	// Reloads the whole schedule. Wired up by weekly-view.js during init so
	// feature modules can trigger a refresh without importing the entry module.
	reload: async () => {},
};

// Cached DOM references. Populated at module load — weekly-view.js is a deferred
// ES module, so the document is already parsed when this evaluates.
export const dom = {
	timeColumn: document.getElementById("time-column"),
	calendarGrid: document.getElementById("calendar-grid"),
	calendarContainer: document.querySelector(".calendar-container"),
	calendarEmptyState: document.getElementById("calendar-empty-state"),
	sidebarPlanner: document.getElementById("sidebar-planner"),
	sidebarConflicts: document.getElementById("sidebar-conflicts"),
	totalCredits: document.getElementById("total-credits"),
	sidebarBuckets: document.getElementById("sidebar-buckets"),
	statCourses: document.getElementById("stat-courses"),
	statHours: document.getElementById("stat-hours"),
	btnAddBucket: document.getElementById("btn-add-bucket"),
	btnDeleteBucket: document.getElementById("btn-delete-bucket"),
	btnSidebarToggle: document.getElementById("btn-sidebar-toggle"),
	btnExportCalendar: document.getElementById("btn-export-calendar"),
	weeklySidebar: document.getElementById("weekly-sidebar"),
	metadataDrawer: document.getElementById("course-metadata-drawer"),
	metadataDrawerBackdrop: document.getElementById("course-metadata-backdrop"),
	metadataDrawerBody: document.getElementById("course-metadata-drawer-body"),
	metadataDrawerTitle: document.getElementById("course-metadata-drawer-title"),
	metadataDrawerClose: document.getElementById("course-metadata-close"),
};
