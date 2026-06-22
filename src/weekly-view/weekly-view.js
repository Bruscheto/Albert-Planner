// Weekly view entry point. Wires the feature modules together and owns the
// top-level schedule load + event wiring. Runtime state and DOM refs live in
// ./runtime.js; feature logic lives in the sibling modules.

import "../shared/chrome-mock.js";
import { getProfessorRatings as loadStoredProfessorRatings } from "../storage/course-storage.js";
import {
	hasPlannerSessionChange,
	loadPlannerSession,
} from "../planner/session.js";
import { formatTime } from "../shared/time-parser.js";

import {
	applyLoadedScheduleState,
	getActiveMetadataCourseId,
	getAddBucketButton,
	getCalendarEmptyState,
	getCalendarGrid,
	getConflictsToggle,
	getDeleteBucketButton,
	getExportCalendarButton,
	getMetadataDrawerBackdrop,
	getMetadataDrawerCloseButton,
	getPlannerSelectionSet,
	getSidebarConflicts,
	getSidebarToggleButton,
	getStatCourses,
	getStatHours,
	getTotalCredits,
	getWeeklySidebar,
	getWeeklyTermBadge,
	hasCourse,
	isDeleteMode,
	isSidebarOpen,
	isShowingConflicts,
	replaceProfessorRatings,
	resetLoadedScheduleState,
	setScheduleReloadHandler,
	setShowConflictsState,
	setSidebarOpenState,
	setSkipDrawerRefresh,
	shouldSkipDrawerRefresh,
	getPendingBucketDeletionCount,
} from "./runtime.js";
import { createWeeklyScheduleModel } from "./schedule-model.js";
import {
	generateTimeLabels,
	generateHourLines,
	generateQuarterTicks,
	renderTimeAnchors,
	mountNowIndicator,
	updateNowIndicator,
} from "./calendar-grid.js";
import {
	renderCourseBlocks,
	clearCourseBlocks,
	toggleCalendarEmptyState,
} from "./course-blocks.js";
import {
	renderBucketsSidebar,
	buildBucketGroups,
	buildBucketMap,
	renderPlanningTray,
} from "./buckets.js";
import {
	handleBucketCreate,
	enterDeleteMode,
	exitDeleteMode,
	deleteSelectedBuckets,
} from "./bucket-actions.js";
import {
	renderCourseMetadataDrawer,
	closeCourseMetadataDrawer,
} from "./metadata-drawer.js";
import { handleExportCalendar } from "./calendar-export.js";
import { showToast } from "./ui-feedback.js";
import {
	handleCalendarDragEnter,
	handleCalendarDragOver,
	handleCalendarDragLeave,
	handleCalendarDrop,
} from "./drag-drop.js";
import { setupHoverHighlight } from "./hover-highlight.js";

const SIDEBAR_STORAGE_KEY = "weeklySidebarOpen";
const SECTION_COLLAPSE_KEY = "weeklySectionCollapseState";
const SHOW_CONFLICTS_KEY = "weeklyShowConflicts";
const EMPTY_STATS = Object.freeze({
	totalCredits: 0,
	totalCourses: 0,
	weeklyHours: 0,
	earliestStart: null,
	latestEnd: null,
});
let latestScheduleLoadId = 0;

// ============ Section Collapse ============

function getSectionCollapseState() {
	try {
		const stored = window.localStorage.getItem(SECTION_COLLAPSE_KEY);
		if (stored) return JSON.parse(stored);
	} catch (e) {
		// Ignore storage access failures in extension contexts.
	}
	return {};
}

function saveSectionCollapseState(collapseState) {
	try {
		window.localStorage.setItem(
			SECTION_COLLAPSE_KEY,
			JSON.stringify(collapseState),
		);
	} catch (e) {
		// Ignore storage access failures in extension contexts.
	}
}

function applySectionCollapseStates() {
	const collapseState = getSectionCollapseState();
	document
		.querySelectorAll(".sidebar-section[data-section]")
		.forEach((section) => {
			const key = section.dataset.section;
			if (collapseState[key]) {
				section.classList.add("is-collapsed");
			}
		});
}

function toggleSectionCollapse(sectionEl) {
	const key = sectionEl.dataset.section;
	if (!key) return;
	const isCollapsed = sectionEl.classList.toggle("is-collapsed");
	const collapseState = getSectionCollapseState();
	collapseState[key] = isCollapsed;
	saveSectionCollapseState(collapseState);
}

// ============ Sidebar ============

function getStoredSidebarPreference() {
	try {
		const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
		if (stored === "false") return false;
		if (stored === "true") return true;
	} catch (error) {
		// Ignore storage access failures in extension contexts.
	}
	return true;
}

function applySidebarState() {
	const sidebarOpen = isSidebarOpen();
	const sidebarToggleButton = getSidebarToggleButton();
	const weeklySidebar = getWeeklySidebar();
	document.body.classList.toggle("weekly-sidebar-collapsed", !sidebarOpen);
	if (sidebarToggleButton) {
		sidebarToggleButton.setAttribute("aria-expanded", String(sidebarOpen));
		sidebarToggleButton.setAttribute(
			"aria-label",
			sidebarOpen ? "Collapse planning drawer" : "Expand planning drawer",
		);
		sidebarToggleButton.title = sidebarOpen
			? "Collapse planning drawer"
			: "Expand planning drawer";
		sidebarToggleButton.classList.toggle("is-collapsed", !sidebarOpen);
	}
	if (weeklySidebar) {
		weeklySidebar.setAttribute("aria-hidden", String(!sidebarOpen));
	}
}

function setSidebarOpen(nextOpen) {
	setSidebarOpenState(nextOpen);
	applySidebarState();
	try {
		window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen()));
	} catch (error) {
		// Ignore storage access failures in extension contexts.
	}
}

function toggleSidebar() {
	setSidebarOpen(!isSidebarOpen());
}

// ============ Conflicts Toggle ============

function getStoredShowConflicts() {
	try {
		return window.localStorage.getItem(SHOW_CONFLICTS_KEY) !== "false";
	} catch (error) {
		return true;
	}
}

function applyConflictsToggleState() {
	const conflictsToggle = getConflictsToggle();
	if (conflictsToggle) {
		conflictsToggle.checked = isShowingConflicts();
	}
}

function setShowConflicts(nextOn) {
	setShowConflictsState(nextOn);
	applyConflictsToggleState();
	try {
		window.localStorage.setItem(SHOW_CONFLICTS_KEY, String(isShowingConflicts()));
	} catch (error) {
		// Ignore storage access failures in extension contexts.
	}
	loadSchedule();
}

// ============ Schedule load ============

async function loadSchedule() {
	const loadId = ++latestScheduleLoadId;
	try {
		clearCourseBlocks();
		setCalendarEmptyStateContent({
			title: "Drag courses into the calendar",
			lines: [
				"Use the bucket list to shortlist classes, then drag them here to test combinations.",
				"Tip: drag a block back to unsorted to remove it from this view.",
			],
			hintIndex: 1,
		});
		const {
			courses,
			buckets,
			plannerSelection,
			professorRatings,
			termBadgeLabel,
		} = await loadPlannerSession();
		if (loadId !== latestScheduleLoadId) return;

		const weeklyTermBadge = getWeeklyTermBadge();
		if (weeklyTermBadge) {
			weeklyTermBadge.textContent = termBadgeLabel;
		}

		const model = createWeeklyScheduleModel({
			courses,
			buckets,
			plannerSelection,
		});

		applyLoadedScheduleState({ buckets, model, professorRatings });

		updatePlannerStats(model.stats);
		const grouped = buildBucketGroups(courses, buckets);
		const bucketMap = buildBucketMap(buckets);
		renderPlanningTray(model.plannedCourses, bucketMap);
		renderBucketsSidebar(grouped, getPlannerSelectionSet());

		renderConflictsSidebar(
			model.conflicts,
			model.conflictColorMap,
			model.incompleteWarnings,
		);
		renderCourseBlocks(model.plannedSchedule, buckets, {
			highlightConflicts: isShowingConflicts() && model.conflictCourseIds.size > 0,
			conflictCourseIds: model.conflictCourseIds,
			conflictColorMap: model.conflictColorMap,
		});
		toggleCalendarEmptyState(model.plannedSchedule.length === 0);
		const activeMetadataCourseId = getActiveMetadataCourseId();
		if (activeMetadataCourseId && !shouldSkipDrawerRefresh()) {
			if (hasCourse(activeMetadataCourseId)) {
				renderCourseMetadataDrawer();
			} else {
				closeCourseMetadataDrawer();
			}
		}
	} catch (error) {
		console.error("[Albert Enhancer] Error loading schedule", error);
		renderScheduleLoadFailure();
		showToast("Schedule failed to load", "error");
	}
}

function setCalendarEmptyStateContent({
	title,
	lines = [],
	hintIndex = -1,
	isError = false,
}) {
	const calendarEmptyState = getCalendarEmptyState();
	if (!calendarEmptyState) return;

	calendarEmptyState.classList.toggle("is-error", isError);
	calendarEmptyState.replaceChildren();

	const heading = document.createElement("h3");
	heading.textContent = title;
	calendarEmptyState.appendChild(heading);

	lines.forEach((line, index) => {
		const paragraph = document.createElement("p");
		if (index === hintIndex) {
			paragraph.className = "calendar-empty-hint";
		}
		paragraph.textContent = line;
		calendarEmptyState.appendChild(paragraph);
	});
}

function renderScheduleLoadFailure() {
	resetLoadedScheduleState();

	const weeklyTermBadge = getWeeklyTermBadge();
	if (weeklyTermBadge) {
		weeklyTermBadge.textContent = "schedule";
	}

	updatePlannerStats(EMPTY_STATS);
	renderPlanningTray([], new Map());
	renderBucketsSidebar({}, new Set());
	renderConflictsSidebar([], new Map(), []);
	toggleCalendarEmptyState(true);
	setCalendarEmptyStateContent({
		title: "Could not load schedule",
		lines: [
			"Refresh the planner or reopen the extension.",
			"Your saved course data was not changed.",
		],
		hintIndex: 1,
		isError: true,
	});

	if (getActiveMetadataCourseId()) {
		closeCourseMetadataDrawer();
	}
}

// ============ Stats & conflicts ============

function updatePlannerStats(stats) {
	const totalCredits = getTotalCredits();
	const statCourses = getStatCourses();
	const statHours = getStatHours();
	if (totalCredits) totalCredits.textContent = stats.totalCredits;
	if (statCourses) statCourses.textContent = stats.totalCourses;
	if (statHours) statHours.textContent = stats.weeklyHours.toFixed(1);

	const headerCourseCount = document.getElementById("header-course-count");
	if (headerCourseCount) {
		headerCourseCount.textContent = `${stats.totalCourses} course${stats.totalCourses !== 1 ? "s" : ""} planned`;
	}

	const statEarliest = document.getElementById("stat-earliest");
	const statLatest = document.getElementById("stat-latest");

	if (stats.totalCourses > 0) {
		if (statEarliest) {
			statEarliest.textContent = stats.earliestStart
				? formatTime(stats.earliestStart)
				: "—";
		}
		if (statLatest) {
			statLatest.textContent = stats.latestEnd ? formatTime(stats.latestEnd) : "—";
		}
	} else {
		if (statEarliest) statEarliest.textContent = "—";
		if (statLatest) statLatest.textContent = "—";
	}
}

function renderConflictsSidebar(conflicts = [], conflictColorMap = new Map(), warnings = []) {
	const sidebarConflicts = getSidebarConflicts();
	if (!sidebarConflicts) return;

	if (!conflicts.length && !warnings.length) {
		sidebarConflicts.innerHTML =
			'<p class="no-conflicts">// no conflicts detected</p>';
		return;
	}

	sidebarConflicts.innerHTML = "";

	for (const entry of conflicts) {
		const conflictItem = document.createElement("div");
		conflictItem.className = "conflict-item";

		const conflictColor = conflictColorMap.get(entry.course?.id);
		if (conflictColor) {
			conflictItem.style.setProperty("--conflict-fill", conflictColor.fill);
			conflictItem.style.setProperty("--conflict-border", conflictColor.border);
		}

		const baseCode = entry.course?.courseCode || "Unknown course";
		const conflictingCodes = entry.conflictsWith
			.map((course) => course?.courseCode)
			.filter(Boolean)
			.filter((code, index, arr) => arr.indexOf(code) === index)
			.join(", ");
		const swatch = '<span class="conflict-swatch" aria-hidden="true"></span>';

		conflictItem.innerHTML = conflictingCodes
			? `${swatch}<div><strong>${baseCode}</strong><br>Conflicts with ${conflictingCodes}</div>`
			: `${swatch}<div><strong>${baseCode}</strong><br>Has schedule conflicts</div>`;

		sidebarConflicts.appendChild(conflictItem);
	}

	for (const warning of warnings) {
		const warningItem = document.createElement("div");
		warningItem.className = "warning-item";
		const missingLabel = warning.missingTypes.join(", ");
		warningItem.innerHTML = `<span class="warning-icon" aria-hidden="true">⚠</span><div><strong>${warning.course.courseCode}</strong><br>${missingLabel} not scheduled</div>`;
		sidebarConflicts.appendChild(warningItem);
	}
}

// ============ Event Listeners ============

function setupEventListeners() {
	getAddBucketButton()?.addEventListener("click", () => {
		if (isDeleteMode()) {
			exitDeleteMode();
			return;
		}
		handleBucketCreate();
	});
	getSidebarToggleButton()?.addEventListener("click", toggleSidebar);
	getExportCalendarButton()?.addEventListener("click", handleExportCalendar);
	getConflictsToggle()?.addEventListener("change", (event) => {
		setShowConflicts(event.target.checked);
	});
	getMetadataDrawerCloseButton()?.addEventListener("click", closeCourseMetadataDrawer);
	getMetadataDrawerBackdrop()?.addEventListener("click", closeCourseMetadataDrawer);
	document.addEventListener("click", handleDeleteModeOutsideClick, true);

	document
		.querySelectorAll(
			".sidebar-section[data-section] > .sidebar-section-header",
		)
		.forEach((header) => {
			header.addEventListener("click", (e) => {
				if (e.target.closest(".sidebar-actions")) return;
				toggleSectionCollapse(header.closest(".sidebar-section"));
			});
			header.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggleSectionCollapse(header.closest(".sidebar-section"));
				}
			});
		});

	getCalendarGrid()?.addEventListener("dragenter", handleCalendarDragEnter);
	getCalendarGrid()?.addEventListener("dragover", handleCalendarDragOver);
	getCalendarGrid()?.addEventListener("dragleave", handleCalendarDragLeave);
	getCalendarGrid()?.addEventListener("drop", handleCalendarDrop);

	getDeleteBucketButton()?.addEventListener("click", () => {
		if (!isDeleteMode()) {
			enterDeleteMode();
			return;
		}
		if (getPendingBucketDeletionCount() === 0) {
			exitDeleteMode();
			return;
		}
		deleteSelectedBuckets();
	});

	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (
			namespace === "local" &&
			hasPlannerSessionChange(changes)
		) {
			clearCourseBlocks();
			loadSchedule();
		}
	});

	document.addEventListener("professor-ratings-changed", async () => {
		replaceProfessorRatings(await loadStoredProfessorRatings());
		setSkipDrawerRefresh(true);
		clearCourseBlocks();
		await loadSchedule();
		setSkipDrawerRefresh(false);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && getActiveMetadataCourseId()) {
			closeCourseMetadataDrawer();
			return;
		}
		if (event.key === "Escape" && isSidebarOpen()) {
			setSidebarOpen(false);
		}
	});
}

function handleDeleteModeOutsideClick(event) {
	if (!isDeleteMode()) return;

	const target = event.target;
	if (!(target instanceof Element)) return;
	if (
		target.closest("#btn-delete-bucket") ||
		target.closest("#sidebar-buckets")
	) {
		return;
	}

	exitDeleteMode();
	event.preventDefault();
	event.stopPropagation();
}

// ============ Initialization ============

async function init() {
	setSidebarOpenState(getStoredSidebarPreference());
	applySidebarState();
	setShowConflictsState(getStoredShowConflicts());
	applyConflictsToggleState();
	applySectionCollapseStates();
	generateTimeLabels();
	generateHourLines();
	generateQuarterTicks();
	renderTimeAnchors();
	mountNowIndicator();
	updateNowIndicator();
	setInterval(updateNowIndicator, 60 * 1000);
	await loadSchedule();
	setupEventListeners();
	setupHoverHighlight();
}

setScheduleReloadHandler(loadSchedule);

init();
