// Weekly view entry point. Wires the feature modules together and owns the
// top-level schedule load + event wiring. State and DOM refs live in
// ./weekly-view/context.js; feature logic lives in the sibling modules.

import {
	getBuckets,
	getCourses,
	getPlannerSelection,
	getProfessorRatings,
} from "./course-storage.js";
import { flattenToSchedule } from "./planner.js";
import {
	calculateWeeklyHours,
	findConflicts,
	getEarliestStart,
	getLatestEnd,
} from "./utils/calendar-utils.js";
import { formatTime } from "./utils/time-parser.js";

import { state, dom } from "./weekly-view/context.js";
import { buildConflictColorMap } from "./weekly-view/colors.js";
import {
	generateTimeLabels,
	generateHourLines,
	generateQuarterTicks,
	renderTimeAnchors,
	mountNowIndicator,
	updateNowIndicator,
} from "./weekly-view/calendar-grid.js";
import {
	renderCourseBlocks,
	clearCourseBlocks,
	toggleCalendarEmptyState,
} from "./weekly-view/course-blocks.js";
import {
	renderBucketsSidebar,
	buildBucketGroups,
	buildBucketMap,
	renderPlanningTray,
} from "./weekly-view/buckets.js";
import {
	handleBucketCreate,
	enterDeleteMode,
	exitDeleteMode,
	deleteSelectedBuckets,
} from "./weekly-view/bucket-actions.js";
import {
	renderCourseMetadataDrawer,
	closeCourseMetadataDrawer,
} from "./weekly-view/metadata-drawer.js";
import { handleExportCalendar } from "./weekly-view/calendar-export.js";
import {
	handleCalendarDragEnter,
	handleCalendarDragOver,
	handleCalendarDragLeave,
	handleCalendarDrop,
} from "./weekly-view/drag-drop.js";
import { setupHoverHighlight } from "./weekly-view/hover-highlight.js";

const SIDEBAR_STORAGE_KEY = "weeklySidebarOpen";
const SECTION_COLLAPSE_KEY = "weeklySectionCollapseState";

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
	document.body.classList.toggle("weekly-sidebar-collapsed", !state.isSidebarOpen);
	if (dom.btnSidebarToggle) {
		dom.btnSidebarToggle.setAttribute("aria-expanded", String(state.isSidebarOpen));
		dom.btnSidebarToggle.setAttribute(
			"aria-label",
			state.isSidebarOpen ? "Collapse planning drawer" : "Expand planning drawer",
		);
		dom.btnSidebarToggle.title = state.isSidebarOpen
			? "Collapse planning drawer"
			: "Expand planning drawer";
		dom.btnSidebarToggle.classList.toggle("is-collapsed", !state.isSidebarOpen);
	}
	if (dom.weeklySidebar) {
		dom.weeklySidebar.setAttribute("aria-hidden", String(!state.isSidebarOpen));
	}
}

function setSidebarOpen(nextOpen) {
	state.isSidebarOpen = Boolean(nextOpen);
	applySidebarState();
	try {
		window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.isSidebarOpen));
	} catch (error) {
		// Ignore storage access failures in extension contexts.
	}
}

function toggleSidebar() {
	setSidebarOpen(!state.isSidebarOpen);
}

// ============ Schedule load ============

async function loadSchedule() {
	try {
		clearCourseBlocks();
		const [courses, buckets, plannerSelection, profRatings] =
			await Promise.all([
				getCourses(),
				getBuckets(),
				getPlannerSelection(),
				getProfessorRatings(),
			]);
		state.cachedProfRatings = profRatings;

		state.coursesById = new Map(courses.map((course) => [course.id, course]));
		state.currentBuckets = buckets;
		state.plannerSelectionSet = new Set(plannerSelection);
		const plannedCourses = courses.filter((course) =>
			state.plannerSelectionSet.has(course.id),
		);
		const plannedSchedule = flattenToSchedule(plannedCourses);
		state.cachedPlannedSchedule = plannedSchedule;

		updatePlannerStats(plannedCourses, plannedSchedule);
		const grouped = buildBucketGroups(courses, buckets);
		const bucketMap = buildBucketMap(buckets);
		renderPlanningTray(plannedCourses, bucketMap);
		renderBucketsSidebar(grouped, state.plannerSelectionSet);

		const { conflicts, conflictCourseIds } = calculatePlannerConflicts(
			plannedCourses,
			plannedSchedule,
		);
		const conflictColorMap = buildConflictColorMap(conflictCourseIds);
		const incompleteWarnings = checkIncompleteScheduling(plannedCourses);
		renderConflictsSidebar(conflicts, conflictColorMap, incompleteWarnings);
		renderCourseBlocks(plannedSchedule, buckets, {
			highlightConflicts: conflictCourseIds.size > 0,
			conflictCourseIds,
			conflictColorMap,
		});
		toggleCalendarEmptyState(plannedSchedule.length === 0);
		if (state.activeMetadataCourseId && !state.skipDrawerRefresh) {
			if (state.coursesById.has(state.activeMetadataCourseId)) {
				renderCourseMetadataDrawer();
			} else {
				closeCourseMetadataDrawer();
			}
		}
	} catch (error) {
		console.error("[Albert Enhancer] Error loading schedule", error);
	}
}

// ============ Stats & conflicts ============

function updatePlannerStats(plannedCourses, plannedSchedule) {
	const totalPlanned = plannedCourses.length;
	const totalCreditsValue = plannedCourses.reduce(
		(sum, course) => sum + (course.credits || 0),
		0,
	);
	const weeklyHours = calculateWeeklyHours(plannedSchedule);
	dom.totalCredits.textContent = totalCreditsValue;
	dom.statCourses.textContent = totalPlanned;
	dom.statHours.textContent = weeklyHours.toFixed(1);

	const headerCourseCount = document.getElementById("header-course-count");
	if (headerCourseCount) {
		headerCourseCount.textContent = `${totalPlanned} course${totalPlanned !== 1 ? "s" : ""} planned`;
	}

	const statEarliest = document.getElementById("stat-earliest");
	const statLatest = document.getElementById("stat-latest");

	if (plannedSchedule.length > 0) {
		const earliest = getEarliestStart(plannedSchedule);
		const latest = getLatestEnd(plannedSchedule);
		if (statEarliest)
			statEarliest.textContent = earliest ? formatTime(earliest) : "—";
		if (statLatest)
			statLatest.textContent = latest ? formatTime(latest) : "—";
	} else {
		if (statEarliest) statEarliest.textContent = "—";
		if (statLatest) statLatest.textContent = "—";
	}
}

function calculatePlannerConflicts(plannedCourses, plannedSchedule) {
	const formatted = [];
	const conflictCourseIds = new Set();

	for (const course of plannedCourses) {
		const conflicts = findConflicts(course, plannedSchedule);
		if (!conflicts.length) {
			continue;
		}

		const conflictingIds = new Set();
		for (const conflict of conflicts) {
			conflictingIds.add(conflict.existingCourse);
			conflictCourseIds.add(conflict.existingCourse);
		}
		conflictCourseIds.add(course.id);

		const conflictsWith = Array.from(conflictingIds)
			.map((id) => state.coursesById.get(id))
			.filter(Boolean);
		if (!conflictsWith.length) {
			continue;
		}

		formatted.push({ course, conflictsWith });
	}

	return { conflicts: formatted, conflictCourseIds };
}

function checkIncompleteScheduling(plannedCourses) {
	const warnings = [];
	for (const course of plannedCourses) {
		if (!course.components || course.components.length <= 1) continue;

		const withTime = [];
		const withoutTime = [];
		for (const comp of course.components) {
			if (comp.timeRange && comp.days && comp.days.length > 0) {
				withTime.push(comp);
			} else {
				withoutTime.push(comp);
			}
		}

		if (withTime.length > 0 && withoutTime.length > 0) {
			const missingTypes = [
				...new Set(withoutTime.map((c) => c.type || "Section")),
			];
			warnings.push({ course, missingTypes });
		}
	}
	return warnings;
}

function renderConflictsSidebar(conflicts = [], conflictColorMap = new Map(), warnings = []) {
	if (!dom.sidebarConflicts) return;

	if (!conflicts.length && !warnings.length) {
		dom.sidebarConflicts.innerHTML =
			'<p class="no-conflicts">// no conflicts detected</p>';
		return;
	}

	dom.sidebarConflicts.innerHTML = "";

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

		dom.sidebarConflicts.appendChild(conflictItem);
	}

	for (const warning of warnings) {
		const warningItem = document.createElement("div");
		warningItem.className = "warning-item";
		const missingLabel = warning.missingTypes.join(", ");
		warningItem.innerHTML = `<span class="warning-icon" aria-hidden="true">⚠</span><div><strong>${warning.course.courseCode}</strong><br>${missingLabel} not scheduled</div>`;
		dom.sidebarConflicts.appendChild(warningItem);
	}
}

// ============ Event Listeners ============

function setupEventListeners() {
	dom.btnAddBucket?.addEventListener("click", () => handleBucketCreate());
	dom.btnSidebarToggle?.addEventListener("click", toggleSidebar);
	dom.btnExportCalendar?.addEventListener("click", handleExportCalendar);
	dom.metadataDrawerClose?.addEventListener("click", closeCourseMetadataDrawer);
	dom.metadataDrawerBackdrop?.addEventListener("click", closeCourseMetadataDrawer);

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

	dom.calendarGrid?.addEventListener("dragenter", handleCalendarDragEnter);
	dom.calendarGrid?.addEventListener("dragover", handleCalendarDragOver);
	dom.calendarGrid?.addEventListener("dragleave", handleCalendarDragLeave);
	dom.calendarGrid?.addEventListener("drop", handleCalendarDrop);

	dom.btnDeleteBucket?.addEventListener("click", () => {
		if (!state.deleteMode) {
			enterDeleteMode();
			return;
		}
		if (state.bucketsPendingDeletion.size === 0) {
			exitDeleteMode();
			return;
		}
		deleteSelectedBuckets();
	});

	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (
			namespace === "local" &&
			(changes.courses || changes.buckets || changes.plannerSelection || changes.professorRatings)
		) {
			clearCourseBlocks();
			loadSchedule();
		}
	});

	document.addEventListener("professor-ratings-changed", async () => {
		state.cachedProfRatings = await getProfessorRatings();
		state.skipDrawerRefresh = true;
		clearCourseBlocks();
		await loadSchedule();
		state.skipDrawerRefresh = false;
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && state.activeMetadataCourseId) {
			closeCourseMetadataDrawer();
			return;
		}
		if (event.key === "Escape" && state.isSidebarOpen) {
			setSidebarOpen(false);
		}
	});
}

// ============ Initialization ============

async function init() {
	state.isSidebarOpen = getStoredSidebarPreference();
	applySidebarState();
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

// Let feature modules trigger a full reload without importing this module.
state.reload = loadSchedule;

init();
