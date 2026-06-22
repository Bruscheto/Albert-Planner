// Weekly-view runtime state, DOM references, and cross-module actions.

const state = {
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
	activeMetadataComponentSection: null,
	activeMetadataComponentType: null,
	lastCourseBlockDragEndedAt: 0,
	isSidebarOpen: true,
	cachedPlannedSchedule: [],
	dragPreviewGhosts: [],
	dragPreviewPill: null,
	dragPreviewCursorHandler: null,
	cachedProfRatings: {},
	skipDrawerRefresh: false,
	showConflicts: true,
};

const dom = {
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
	weeklyTermBadge: document.getElementById("weekly-term-badge"),
	btnAddBucket: document.getElementById("btn-add-bucket"),
	btnDeleteBucket: document.getElementById("btn-delete-bucket"),
	btnSidebarToggle: document.getElementById("btn-sidebar-toggle"),
	btnExportCalendar: document.getElementById("btn-export-calendar"),
	toggleConflicts: document.getElementById("toggle-conflicts"),
	weeklySidebar: document.getElementById("weekly-sidebar"),
	metadataDrawer: document.getElementById("course-metadata-drawer"),
	metadataDrawerBackdrop: document.getElementById("course-metadata-backdrop"),
	metadataDrawerBody: document.getElementById("course-metadata-drawer-body"),
	metadataDrawerTitle: document.getElementById("course-metadata-drawer-title"),
	metadataDrawerClose: document.getElementById("course-metadata-close"),
};

let reloadHandler = async () => {};

export function getTimeColumn() {
	return dom.timeColumn;
}

export function getCalendarGrid() {
	return dom.calendarGrid;
}

export function getWeeklySidebar() {
	return dom.weeklySidebar;
}

export function getExportCalendarButton() {
	return dom.btnExportCalendar;
}

export function getCalendarContainer() {
	return dom.calendarContainer;
}

export function getSidebarBuckets() {
	return dom.sidebarBuckets;
}

export function getSidebarPlanner() {
	return dom.sidebarPlanner;
}

export function getSidebarConflicts() {
	return dom.sidebarConflicts;
}

export function getTotalCredits() {
	return dom.totalCredits;
}

export function getStatCourses() {
	return dom.statCourses;
}

export function getStatHours() {
	return dom.statHours;
}

export function getWeeklyTermBadge() {
	return dom.weeklyTermBadge;
}

export function getAddBucketButton() {
	return dom.btnAddBucket;
}

export function getDeleteBucketButton() {
	return dom.btnDeleteBucket;
}

export function getSidebarToggleButton() {
	return dom.btnSidebarToggle;
}

export function getConflictsToggle() {
	return dom.toggleConflicts;
}

export function getMetadataDrawerBody() {
	return dom.metadataDrawerBody;
}

export function getMetadataDrawerCloseButton() {
	return dom.metadataDrawerClose;
}

export function getMetadataDrawerBackdrop() {
	return dom.metadataDrawerBackdrop;
}

export function setMetadataDrawerInert(isInert) {
	if (isInert) {
		dom.metadataDrawer?.setAttribute("inert", "");
	} else {
		dom.metadataDrawer?.removeAttribute("inert");
	}
}

export function getProfessorRating(instructorName) {
	return state.cachedProfRatings[instructorName];
}

export function getProfessorRatings() {
	return state.cachedProfRatings;
}

export function replaceProfessorRatings(professorRatings) {
	state.cachedProfRatings = professorRatings;
}

export function isDraggingCourse() {
	return Boolean(state.draggedCourseId);
}

export function didCourseBlockDragEndRecently(now = Date.now()) {
	return now - state.lastCourseBlockDragEndedAt < 200;
}

export function setCalendarEmptyStateVisible(isVisible) {
	dom.calendarEmptyState?.classList.toggle("is-hidden", !isVisible);
}

export function getCalendarEmptyState() {
	return dom.calendarEmptyState;
}

export function getPlannerSelectionSet() {
	return state.plannerSelectionSet;
}

export function isPlannerCourseSelected(courseId) {
	return state.plannerSelectionSet.has(courseId);
}

export function getCourseById(courseId) {
	return state.coursesById.get(courseId);
}

export function hasCourse(courseId) {
	return state.coursesById.has(courseId);
}

export function getCurrentBuckets() {
	return state.currentBuckets;
}

export function getCachedPlannedSchedule() {
	return state.cachedPlannedSchedule;
}

export function getBucketCollapsed(collapseKey) {
	if (!state.bucketCollapseState.has(collapseKey)) {
		state.bucketCollapseState.set(collapseKey, true);
	}
	return state.bucketCollapseState.get(collapseKey);
}

export function setBucketCollapsed(collapseKey, isCollapsed) {
	state.bucketCollapseState.set(collapseKey, Boolean(isCollapsed));
}

export function removeBucketCollapseState(bucketId) {
	state.bucketCollapseState.delete(bucketId);
}

export function isDeleteMode() {
	return state.deleteMode;
}

export function setDeleteMode(nextDeleteMode) {
	state.deleteMode = Boolean(nextDeleteMode);
}

export function getPendingBucketDeletionCount() {
	return state.bucketsPendingDeletion.size;
}

export function getPendingBucketDeletionIds() {
	return Array.from(state.bucketsPendingDeletion);
}

export function isBucketPendingDeletion(bucketId) {
	return state.bucketsPendingDeletion.has(bucketId);
}

export function clearPendingBucketDeletions() {
	state.bucketsPendingDeletion.clear();
}

export function togglePendingBucketDeletion(bucketId) {
	if (state.bucketsPendingDeletion.has(bucketId)) {
		state.bucketsPendingDeletion.delete(bucketId);
		return false;
	}
	state.bucketsPendingDeletion.add(bucketId);
	return true;
}

export function clearActiveRename() {
	state.activeRenameState = null;
}

export function getActiveRenameState() {
	return state.activeRenameState;
}

export function setActiveRenameState(renameState) {
	state.activeRenameState = renameState;
}

export function getActiveMetadataCourseId() {
	return state.activeMetadataCourseId;
}

export function setActiveMetadataCourse(courseId, focusComponent = null) {
	state.activeMetadataCourseId = courseId;
	state.activeMetadataComponentSection = focusComponent?.section ?? null;
	state.activeMetadataComponentType = focusComponent?.type ?? null;
}

export function clearActiveMetadataCourse() {
	state.activeMetadataCourseId = null;
	state.activeMetadataComponentSection = null;
	state.activeMetadataComponentType = null;
}

export function getActiveMetadataFocusComponent(course) {
	if (!state.activeMetadataComponentSection) return null;
	return (
		course.components?.find(
			(component) =>
				component.section === state.activeMetadataComponentSection &&
				component.type === state.activeMetadataComponentType,
		) || null
	);
}

export function shouldSkipDrawerRefresh() {
	return state.skipDrawerRefresh;
}

export function setSkipDrawerRefresh(skipDrawerRefresh) {
	state.skipDrawerRefresh = Boolean(skipDrawerRefresh);
}

export function isSidebarOpen() {
	return state.isSidebarOpen;
}

export function setSidebarOpenState(nextOpen) {
	state.isSidebarOpen = Boolean(nextOpen);
}

export function isShowingConflicts() {
	return state.showConflicts;
}

export function setShowConflictsState(nextOn) {
	state.showConflicts = Boolean(nextOn);
}

export function setDragPayload({ courseId, source, fromBucketId = null }) {
	state.draggedCourseId = courseId;
	state.draggedSource = source;
	state.draggedFromBucketId = fromBucketId;
}

export function getDragPayload() {
	return {
		courseId: state.draggedCourseId,
		source: state.draggedSource,
		fromBucketId: state.draggedFromBucketId,
	};
}

export function getDraggedCourseId() {
	return state.draggedCourseId;
}

export function markCourseBlockDragEnded(now = Date.now()) {
	state.lastCourseBlockDragEndedAt = now;
}

export function clearDragPayload() {
	state.draggedCourseId = null;
	state.draggedSource = null;
	state.draggedFromBucketId = null;
}

export function addDragPreviewGhost(ghost) {
	state.dragPreviewGhosts.push(ghost);
}

export function setDragPreviewPill(pill) {
	state.dragPreviewPill = pill;
}

export function moveDragPreviewPill(clientX, clientY) {
	if (!state.dragPreviewPill || (clientX === 0 && clientY === 0)) return;
	state.dragPreviewPill.style.transform = `translate3d(${clientX + 18}px, ${clientY + 18}px, 0)`;
	if (!state.dragPreviewPill.classList.contains("is-visible")) {
		state.dragPreviewPill.classList.add("is-visible");
	}
}

export function attachDragPreviewCursorHandler(handler) {
	state.dragPreviewCursorHandler = handler;
	document.addEventListener("dragover", state.dragPreviewCursorHandler);
}

export function clearDragPreviewArtifacts() {
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

export function setScheduleReloadHandler(handler) {
	reloadHandler = typeof handler === "function" ? handler : async () => {};
}

export function reloadSchedule() {
	return reloadHandler();
}

export function applyLoadedScheduleState({ buckets, model, professorRatings }) {
	state.cachedProfRatings = professorRatings;
	state.coursesById = model.coursesById;
	state.currentBuckets = buckets;
	state.plannerSelectionSet = model.plannerSelectionSet;
	state.cachedPlannedSchedule = model.plannedSchedule;
}

export function resetLoadedScheduleState() {
	state.cachedProfRatings = {};
	state.coursesById = new Map();
	state.currentBuckets = [];
	state.plannerSelectionSet = new Set();
	state.cachedPlannedSchedule = [];
}
