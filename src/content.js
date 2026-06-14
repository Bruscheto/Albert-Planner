// Content script for Albert pages
// Parses Albert cart data on-demand when requested by popup
// Note: Content scripts can't use *static* ES module imports, but they CAN use
// dynamic import() of web_accessible_resources — so shared parsing logic is loaded
// from src/utils/time-parser.js at runtime instead of being duplicated here.

const DEBUG = true;
const debugLog = (...args) => {
	if (DEBUG) {
		console.log("[Albert Enhancer]", ...args);
	}
};

debugLog("Content script loaded at", window.location.href);

// ============ Shared parsing logic (loaded via dynamic import) ============
// Content scripts can't statically import, but a dynamic import() of a
// web_accessible module works. Loaded once, then reused for every parse.
let parserModulePromise = null;
function loadParsers() {
	if (!parserModulePromise) {
		parserModulePromise = import(
			chrome.runtime.getURL("src/utils/time-parser.js")
		);
	}
	return parserModulePromise;
}

// ============ Selectors for new Albert page structure ============
const SELECTORS = {
	SUMMARY_TERM_WRAPPER: ".isSSS_ShCtTermWrp",
	SUMMARY_CART_TABLE:
		"table.isSSS_ShCtTable.accordion-table",
	SUMMARY_PRIMARY_ROW: "tr.isSSS_ShCtPrim",
	SUMMARY_DETAIL_ROW: "tr.isSSS_ShCtNonPrim",
	// The main cart table with title containing "Shopping Cart"
	CART_TABLE: 'table.ps_grid-flex[title*="Shopping Cart"]',
	// Each row in the cart
	CART_ROW: "tr.ps_grid-row",
	// Inside each row, the layout container
	LAYOUT: "div.ps_box-group.psc_layout",
};

const DRAWER_IDS = {
	panel: "albert-planner-drawer",
	toggle: "albert-planner-toggle",
	iframe: "albert-planner-frame",
};
const PLANNER_HOSTS = new Set(["sis.portal.nyu.edu", "sis.nyu.edu"]);

let drawerInitialized = false;
let contextInvalidatedNotified = false;

function logAvailableTables() {
	const tables = Array.from(document.querySelectorAll("table"));
	if (!tables.length) {
		debugLog("No tables found on page yet");
		return;
	}
	debugLog(
		"Available tables:",
		tables.map((table, idx) => {
			const cls = table.className || "<no-class>";
			const title =
				table.getAttribute("title") ||
				table.getAttribute("summary") ||
				"<no-title>";
			return `#${idx} ${cls} | ${title}`;
		}),
	);
}

function findCartTable() {
	let table = document.querySelector(SELECTORS.CART_TABLE);
	if (table) {
		return table;
	}

	const fallbackTables = Array.from(
		document.querySelectorAll("table.ps_grid-flex"),
	);
	if (!fallbackTables.length) {
		debugLog("No ps_grid-flex tables present yet");
		return null;
	}

	table = fallbackTables.find((t) => {
		const title = t.getAttribute("title") || t.getAttribute("summary") || "";
		return title.toLowerCase().includes("shopping cart");
	});

	if (!table) {
		debugLog(
			"ps_grid-flex tables found but none mention 'Shopping Cart':",
			fallbackTables.map((t, idx) => ({
				idx,
				title: t.getAttribute("title"),
				summary: t.getAttribute("summary"),
				className: t.className,
			})),
		);
	}

	return table || null;
}

function findSummaryCartTable() {
	const selectedWrapper = document.querySelector(
		`${SELECTORS.SUMMARY_TERM_WRAPPER}.selected`,
	);
	if (selectedWrapper) {
		return selectedWrapper.querySelector(SELECTORS.SUMMARY_CART_TABLE) ||
			selectedWrapper;
	}

	const tables = Array.from(document.querySelectorAll(SELECTORS.SUMMARY_CART_TABLE));
	for (const table of tables) {
		if (table.querySelector(SELECTORS.SUMMARY_PRIMARY_ROW)) {
			return table;
		}
	}

	return null;
}

// ============ Time Parsing (delegates to shared utils/time-parser.js) ============

/**
 * Parse days/times string like "TuTh 09:30 - 10:45" or "MoWe 11:00 AM - 12:15 PM".
 * Splits the leading day codes from the time range, then delegates to the shared
 * parseDays / parseTimeRange so there is a single source of truth.
 * @param {string} daysTimesStr
 * @param {{ parseDays: Function, parseTimeRange: Function }} parsers
 */
function parseDaysAndTime(daysTimesStr, parsers) {
	if (!daysTimesStr || daysTimesStr.toUpperCase() === "TBA") {
		return { days: [], timeRange: null, isTBA: true };
	}

	const normalized = daysTimesStr.replace(/\s+/g, " ").trim();

	// "TuTh 09:30 - 10:45" -> dayPart "TuTh", rest "09:30 - 10:45"
	const match = normalized.match(/^([A-Za-z]+)\s+(.+)$/);
	if (!match) {
		return { days: [], timeRange: null, isTBA: true };
	}

	const days = parsers.parseDays(match[1]);
	const timeRange = parsers.parseTimeRange(match[2]);

	return { days, timeRange, isTBA: !timeRange };
}

function normalizeText(value) {
	return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLocation(value) {
	return normalizeText(value)
		.replace(/([^\s])Loc:/g, "$1 Loc:")
		.replace(/:\s*/g, ": ");
}

function parseTermInfo(text) {
	const match = normalizeText(text).match(
		/\b(Spring|Summer|Fall|Winter)\s+(\d{4})\b/i,
	);
	if (!match) return null;

	const semester =
		match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
	const year = Number.parseInt(match[2], 10);
	return {
		name: `${semester} ${year}`,
		semester,
		year,
	};
}

function extractTermCode(container) {
	const source = `${container?.id || ""} ${container?.className || ""}`;
	const match = source.match(/(?:^|[^A-Za-z0-9])(?:ShCtTm)?(\d{4})[A-Z]*/);
	return match?.[1] || null;
}

function getSummaryTermInfo(summaryTable) {
	const container =
		summaryTable.matches?.(SELECTORS.SUMMARY_TERM_WRAPPER)
			? summaryTable
			: summaryTable.closest(SELECTORS.SUMMARY_TERM_WRAPPER) ||
				summaryTable.parentElement;
	const headingText =
		container?.querySelector("h2")?.textContent ||
		summaryTable.previousElementSibling?.textContent ||
		"";
	const term = parseTermInfo(headingText);
	if (!term) return null;

	const termCode = extractTermCode(container);
	return termCode ? { ...term, termCode } : term;
}

function getPageTermInfo(anchorElement) {
	let element = anchorElement;
	while (element) {
		const heading = element.querySelector?.("h1,h2,h3");
		const term = parseTermInfo(heading?.textContent);
		if (term) return term;
		element = element.parentElement;
	}
	return parseTermInfo(document.body?.innerText || "");
}

function getCellText(row, label, fallbackIndex) {
	const normalizedLabel = label.toLowerCase().replace(/[^a-z]/g, "");
	const cells = Array.from(row.querySelectorAll("td, th"));
	const matchingCell = cells.find((cell) => {
		const cellLabel = (cell.dataset.label || "")
			.toLowerCase()
			.replace(/[^a-z]/g, "");
		return cellLabel.includes(normalizedLabel);
	});
	return normalizeText(
		(matchingCell || cells[fallbackIndex])?.textContent || "",
	);
}

function getSummaryCourseCell(row) {
	return (
		Array.from(row.querySelectorAll("td")).find((cell) =>
			(cell.dataset.label || "")
				.toLowerCase()
				.replace(/[^a-z]/g, "")
				.includes("course"),
		) || row.querySelector("td")
	);
}

function parseSummaryCourseInfo(row) {
	const cell = getSummaryCourseCell(row);
	if (!cell) return null;

	const cellText = normalizeText(cell.textContent);
	const titleFromAttribute = normalizeText(cell.getAttribute("title"));
	const pattern =
		/^(.*?)\s+([A-Z0-9&-]+-[A-Z0-9&-]+\s+\d+[A-Z]?)\s+([A-Z0-9]+)\s*\(([\d.]+)\)$/i;
	const match = cellText.match(pattern);

	if (!match) {
		debugLog(`Could not parse summary course cell: "${cellText}"`);
		return null;
	}

	return {
		title: titleFromAttribute || normalizeText(match[1]),
		courseCode: normalizeText(match[2]).toUpperCase(),
		section: match[3],
		credits: Number.parseFloat(match[4]) || 0,
	};
}

function parseSummarySchedule(row, parsers) {
	const dayText = getCellText(row, "Day", 4);
	const timeText = getCellText(row, "Time", 3);
	const days = parsers.parseDays(dayText);
	const timeRange = parsers.parseTimeRange(timeText);
	return { days, timeRange, isTBA: !timeRange };
}

function parseSummaryComponent(row, section, parsers) {
	const type = getCellText(row, "Course", 0) || "Lecture";
	const { days, timeRange, isTBA } = parseSummarySchedule(row, parsers);

	return {
		type,
		section,
		days,
		timeRange,
		room: normalizeLocation(getCellText(row, "Location", 2)) || "TBA",
		instructor: getCellText(row, "Instructor", 1) || "TBA",
		isTBA,
		status: "In Cart",
	};
}

function createCourseFromSummaryRow(row, parsers, termInfo) {
	const courseInfo = parseSummaryCourseInfo(row);
	if (!courseInfo) return null;

	const id = `${courseInfo.courseCode}-${courseInfo.section}`.replace(/\s+/g, "-");
	const summaryComponent = parseSummaryComponent(row, courseInfo.section, parsers);

	return {
		course: {
			id,
			courseCode: courseInfo.courseCode,
			section: courseInfo.section,
			title: courseInfo.title,
			credits: courseInfo.credits,
			status: "In Cart",
			components: [],
			bucket: null,
			addedAt: Date.now(),
			...(termInfo ? { term: termInfo } : {}),
		},
		summaryComponent,
	};
}

/**
 * Extract course code from class name link text
 * e.g., "Class Code:CORE-UA 203-010 (15133)" -> { code: "CORE-UA 203", section: "010", classNumber: "15133" }
 */
function parseClassCode(linkText) {
	if (!linkText || typeof linkText !== "string") {
		return null;
	}

	// Format: "Class Code:DEPT-LEVEL NUM-SECTION (classNumber)"
	const patterns = [
		/Class Code:\s*([A-Z\-]+\s+\d+)-(\d+)\s*\((\d+)\)/i,
		/Class Code:\s*([^()]+?)\s*-\s*(\d+)\s*\((\d+)\)/i,
	];

	let match = null;
	for (const pattern of patterns) {
		const candidate = linkText.match(pattern);
		if (candidate) {
			match = candidate;
			break;
		}
	}

	if (!match) {
		return null;
	}

	return {
		code: match[1].trim(), // e.g., "CORE-UA 203"
		section: match[2], // e.g., "010"
		classNumber: match[3], // e.g., "15133"
	};
}

/**
 * Parse a single row from the shopping cart
 */
function parseRow(row, parsers) {
	const layout = row.querySelector(SELECTORS.LAYOUT);
	if (!layout) return null;

	// Get row index from ID (e.g., "win0divCART_GRID$0" -> 0)
	const layoutId = layout.id || "";
	const indexMatch = layoutId.match(/\$(\d+)$/);
	const rowIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

	// Extract class code from the link
	const classNameSpan = layout.querySelector('[id^="P_CLASS_NAME$span"]');
	const classNameText =
		classNameSpan?.getAttribute("title") || classNameSpan?.textContent || "";
	const classInfo = parseClassCode(classNameText);

	if (!classInfo) {
		debugLog(`Could not parse class code from: "${classNameText}"`);
		return null;
	}

	// Section
	const sectionEl = layout.querySelector('[id^="CLASS_TBL_VW_CLASS_SECTION"]');
	const section = sectionEl?.textContent?.trim() || classInfo.section;

	// Description
	const descEl = layout.querySelector('[id^="CLASS_TBL_VW_DESCR"]');
	const description = descEl?.textContent?.trim() || "";

	// Instructor
	const instructorEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_INSTR_LONG"]',
	);
	const instructor = instructorEl?.textContent?.trim() || "TBA";

	// Days/Times
	const daysTimesEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_MTG_SCHED_LONG"]',
	);
	const daysTimesStr = daysTimesEl?.textContent?.trim() || "TBA";
	const { days, timeRange, isTBA } = parseDaysAndTime(daysTimesStr, parsers);

	// Location
	const locationEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_MTG_LOC_LONG"]',
	);
	const location = locationEl?.textContent?.trim() || "TBA";

	// Units - blank means this is a recitation/lab
	const unitsEl = layout.querySelector('[id^="SSR_REGFORM_VW_UNT_TAKEN"]');
	const unitsText = unitsEl?.textContent?.trim() || "";
	const units = parseFloat(unitsText) || 0;
	const isRecitation =
		unitsText === "" || unitsText === "\u00A0" || units === 0;

	// Status
	const statusImg = layout.querySelector(
		'[id^="win0divDERIVED_REGFRM1_SSR_STATUS_LONG"] img',
	);
	const status = statusImg?.getAttribute("alt") || "Unknown";

	return {
		rowIndex,
		courseCode: classInfo.code,
		section,
		classNumber: classInfo.classNumber,
		title: description,
		instructor,
		days,
		timeRange,
		location,
		credits: units,
		status,
		isTBA,
		isRecitation,
	};
}

/**
 * Parse the entire shopping cart and group courses with their recitations
 */
function parseShoppingCart(existingTable, parsers) {
	const cartTable = existingTable || findCartTable();
	if (!cartTable) {
		debugLog("Shopping cart table not found yet");
		logAvailableTables();
		return [];
	}

	debugLog("Found cart table:", cartTable.getAttribute("title"));
	const termInfo = getPageTermInfo(cartTable);

	const rows = cartTable.querySelectorAll(SELECTORS.CART_ROW);
	debugLog("Found", rows.length, "rows in cart");

	const courses = [];
	let currentCourse = null;

	for (const row of rows) {
		const parsed = parseRow(row, parsers);
		if (!parsed) continue;

		debugLog(
			`Row ${parsed.rowIndex}: ${parsed.courseCode}-${parsed.section}, units=${parsed.credits}, isRecit=${parsed.isRecitation}`,
		);

		if (parsed.isRecitation) {
			// This is a recitation - attach to current course if codes match
			if (currentCourse && parsed.courseCode === currentCourse.courseCode) {
				currentCourse.components.push({
					type: "Recitation",
					section: parsed.section,
					days: parsed.days,
					timeRange: parsed.timeRange,
					room: parsed.location,
					instructor: parsed.instructor,
					isTBA: parsed.isTBA,
					status: parsed.status,
				});
				debugLog(
					`Added recitation ${parsed.section} to ${currentCourse.courseCode}`,
				);
			} else {
				debugLog(`Orphan recitation: ${parsed.courseCode}-${parsed.section}`);
			}
		} else {
			// This is a main course - save previous and start new
			if (currentCourse) {
				courses.push(currentCourse);
			}

			const id = `${parsed.courseCode}-${parsed.section}`.replace(/\s+/g, "-");

			currentCourse = {
				id,
				courseCode: parsed.courseCode,
				section: parsed.section,
				classNumber: parsed.classNumber,
				title: parsed.title,
				credits: parsed.credits,
				status: parsed.status,
				components: [
					{
						type: "Lecture",
						section: parsed.section,
						days: parsed.days,
						timeRange: parsed.timeRange,
						room: parsed.location,
						instructor: parsed.instructor,
						isTBA: parsed.isTBA,
						status: parsed.status,
					},
				],
				bucket: null,
				addedAt: Date.now(),
				...(termInfo ? { term: termInfo } : {}),
			};

			debugLog(
				`Parsed course: ${parsed.courseCode}-${parsed.section} (${parsed.credits} credits)`,
			);
		}
	}

	// Don't forget the last course
	if (currentCourse) {
		courses.push(currentCourse);
	}

	return courses;
}

function parseSummaryCart(summarySource, parsers) {
	const summaryTable = summarySource.matches?.(SELECTORS.SUMMARY_CART_TABLE)
		? summarySource
		: summarySource.querySelector?.(SELECTORS.SUMMARY_CART_TABLE);

	if (!summaryTable) {
		debugLog("Enrollment summary cart table not found yet");
		return [];
	}

	debugLog("Found enrollment summary cart table");
	const termInfo = getSummaryTermInfo(summaryTable);
	const rows = summaryTable.querySelectorAll(
		`${SELECTORS.SUMMARY_PRIMARY_ROW}, ${SELECTORS.SUMMARY_DETAIL_ROW}`,
	);
	debugLog("Found", rows.length, "summary cart rows");

	const courses = [];
	let currentCourse = null;
	let currentSummaryComponent = null;

	const pushCurrentCourse = () => {
		if (!currentCourse) return;
		if (currentCourse.components.length === 0 && currentSummaryComponent) {
			currentCourse.components.push(currentSummaryComponent);
		}
		courses.push(currentCourse);
	};

	for (const row of rows) {
		if (row.matches(SELECTORS.SUMMARY_PRIMARY_ROW)) {
			pushCurrentCourse();

			const parsed = createCourseFromSummaryRow(row, parsers, termInfo);
			if (!parsed) {
				currentCourse = null;
				currentSummaryComponent = null;
				continue;
			}

			currentCourse = parsed.course;
			currentSummaryComponent = parsed.summaryComponent;
			debugLog(
				`Parsed summary course: ${currentCourse.courseCode}-${currentCourse.section} (${currentCourse.credits} credits)`,
			);
			continue;
		}

		if (!currentCourse || !row.matches(SELECTORS.SUMMARY_DETAIL_ROW)) {
			continue;
		}

		const component = parseSummaryComponent(row, currentCourse.section, parsers);
		currentCourse.components.push(component);
		debugLog(`Added summary ${component.type} to ${currentCourse.courseCode}`);
	}

	pushCurrentCourse();
	return courses;
}

function parseAlbertCart(cartTable, parsers) {
	if (
		cartTable?.matches(SELECTORS.SUMMARY_CART_TABLE) ||
		cartTable?.matches(SELECTORS.SUMMARY_TERM_WRAPPER)
	) {
		return {
			courses: parseSummaryCart(cartTable, parsers),
			term: getSummaryTermInfo(cartTable),
		};
	}

	const courses = parseShoppingCart(cartTable, parsers);
	return {
		courses,
		term: courses[0]?.term || getPageTermInfo(cartTable),
	};
}

// ============ Enrolled Courses (#isSSS_ShCtSchTable) ============

function findEnrolledTable() {
	return document.getElementById("isSSS_ShCtSchTable");
}

/**
 * Parse the course cell of an enrolled row, e.g.
 * "Operating Systems CSCI-UA 202 002 (4)" or "Algebra MATH-UA 343 008" (recitation, no units).
 */
function parseEnrolledCourseCell(cell) {
	const p =
		cell?.querySelector(".isSSS_CourseTitle p") || cell?.querySelector("p");
	if (!p) return null;

	const text = normalizeText(p.textContent);
	const withUnits =
		/^(.*?)\s+([A-Z0-9&-]+-[A-Z0-9&-]+\s+\d+[A-Z]?)\s+([A-Z0-9]+)\s*\(([\d.]+)\)$/i;
	const withoutUnits =
		/^(.*?)\s+([A-Z0-9&-]+-[A-Z0-9&-]+\s+\d+[A-Z]?)\s+([A-Z0-9]+)$/i;

	const match = text.match(withUnits) || text.match(withoutUnits);
	if (!match) {
		debugLog(`Could not parse enrolled course cell: "${text}"`);
		return null;
	}

	const hasUnits = match[4] !== undefined;
	return {
		crseId: p.getAttribute("data-crseid") || null,
		title: normalizeText(match[1]),
		courseCode: normalizeText(match[2]).toUpperCase(),
		section: p.getAttribute("data-classsection") || match[3],
		credits: hasUnits ? Number.parseFloat(match[4]) || 0 : 0,
	};
}

function parseEnrolledComponent(row, section, type, parsers) {
	const days = parsers.parseDays(getCellText(row, "Day", 4));
	const timeRange = parsers.parseTimeRange(getCellText(row, "Time", 3));
	return {
		type,
		section,
		days,
		timeRange,
		room: normalizeLocation(getCellText(row, "Location", 2)) || "TBA",
		instructor: getCellText(row, "Instructor", 1) || "TBA",
		isTBA: !timeRange,
		status: "Enrolled",
	};
}

/**
 * Parse the "Enrolled Courses" schedule table. Rows sharing a data-crseid belong
 * to the same course: the first is the lecture, the rest are recitations/labs.
 */
function parseEnrolledCourses(enrolledTable, parsers) {
	const termInfo = getPageTermInfo(enrolledTable);
	const rows = enrolledTable.querySelectorAll("tr.accordion-row");
	debugLog("Found", rows.length, "enrolled course rows");

	const courses = [];
	let currentCourse = null;

	for (const row of rows) {
		const courseCell = row.querySelector('td[headers^="tbl_Course"]');
		const info = courseCell ? parseEnrolledCourseCell(courseCell) : null;
		if (!info) continue;

		const sameCourse =
			currentCourse &&
			(info.crseId
				? info.crseId === currentCourse.crseId
				: info.courseCode === currentCourse.courseCode);

		if (sameCourse) {
			currentCourse.components.push(
				parseEnrolledComponent(row, info.section, "Recitation", parsers),
			);
			debugLog(
				`Added enrolled recitation ${info.section} to ${currentCourse.courseCode}`,
			);
			continue;
		}

		if (currentCourse) courses.push(currentCourse);

		const id = `${info.courseCode}-${info.section}`.replace(/\s+/g, "-");
		currentCourse = {
			id,
			crseId: info.crseId,
			courseCode: info.courseCode,
			section: info.section,
			title: info.title,
			credits: info.credits,
			status: "Enrolled",
			components: [
				parseEnrolledComponent(row, info.section, "Lecture", parsers),
			],
			bucket: null,
			addedAt: Date.now(),
			...(termInfo ? { term: termInfo } : {}),
		};
		debugLog(
			`Parsed enrolled course: ${info.courseCode}-${info.section} (${info.credits} credits)`,
		);
	}

	if (currentCourse) courses.push(currentCourse);

	// crseId is only an internal grouping aid; strip it from the returned shape.
	return {
		courses: courses.map(({ crseId, ...course }) => course),
		term: termInfo,
	};
}

// ============ Message Listener ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type !== "PARSE_CART") {
		return false;
	}

	const isLikelyCartUrl = /NYU_SSENRL_CART/i.test(window.location.href);
	const cartTable = findSummaryCartTable() || findCartTable();
	const enrolledTable = findEnrolledTable();

	// Not this frame's job — let the frame that actually has the cart/schedule respond.
	if (!cartTable && !enrolledTable && !isLikelyCartUrl) {
		debugLog("Skipping parse request in non-cart frame", window.location.href);
		return false;
	}

	// This frame will respond; loading the shared parser is async, so keep the
	// message channel open by returning true below.
	handleParseCart(cartTable, enrolledTable, sendResponse);
	return true;
});

async function handleParseCart(cartTable, enrolledTable, sendResponse) {
	try {
		if (!cartTable && !enrolledTable) {
			debugLog("No cart or enrolled table found in this frame yet; logging tables");
			logAvailableTables();
			sendResponse({
				courses: [],
				error: "Shopping cart or enrolled courses table not found on this page.",
			});
			return;
		}

		debugLog("Parse request received in frame", window.location.href);
		const parsers = await loadParsers();

		const cartResult = cartTable
			? parseAlbertCart(cartTable, parsers)
			: { courses: [], term: null };
		const enrolledResult = enrolledTable
			? parseEnrolledCourses(enrolledTable, parsers)
			: { courses: [], term: null };

		const result = {
			courses: [...cartResult.courses, ...enrolledResult.courses],
			term: cartResult.term || enrolledResult.term,
		};
		debugLog("Parsed", result.courses.length, "courses", result.courses);
		sendResponse(result);
	} catch (error) {
		console.error("[Albert Enhancer] Parse cart failed:", error);
		sendResponse({
			courses: [],
			error: "Failed to parse shopping cart.",
		});
	}
}

// ============ Drawer Panel Injection ============

if (window.top === window) {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPlannerDrawer, {
			once: true,
		});
	} else {
		initPlannerDrawer();
	}
}

function initPlannerDrawer() {
	if (drawerInitialized) {
		return;
	}

	// Restrict to specific URL
	const isTargetUrl =
		PLANNER_HOSTS.has(window.location.hostname) &&
		window.location.pathname.startsWith("/psp");

	if (!isTargetUrl) {
		debugLog("Not on target URL for planner toggle");
		return;
	}

	if (!document.body) {
		setTimeout(initPlannerDrawer, 100);
		return;
	}
	drawerInitialized = true;

	const toggle = document.createElement("button");
	toggle.id = DRAWER_IDS.toggle;
	toggle.type = "button";
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-label", "Open Albert Course Planner side panel");

	toggle.innerHTML = `
		<span class="ap-path" aria-hidden="true">~/</span><span class="ap-label">planner</span><span class="ap-arrow" aria-hidden="true">→</span>
	`;

	toggle.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		requestChromeSidePanelOpen();
	});

	document.body.appendChild(toggle);
}

function requestChromeSidePanelOpen() {
	const toggle = document.getElementById(DRAWER_IDS.toggle);

	const markContextInvalidated = () => {
		if (toggle) {
			toggle.disabled = true;
			toggle.style.opacity = "0.65";
			toggle.style.cursor = "not-allowed";
			toggle.setAttribute(
				"title",
				"Extension was reloaded. Refresh this page to re-enable the planner toggle.",
			);
			toggle.setAttribute("aria-label", "Refresh page to re-enable planner");
			const label = toggle.querySelector("span");
			if (label) {
				label.textContent = "Refresh Page";
			}
		}

		if (!contextInvalidatedNotified) {
			contextInvalidatedNotified = true;
			console.info(
				"[Albert Enhancer] Extension context invalidated. Refresh the page to reconnect planner controls.",
			);
		}
	};

	const isContextInvalidatedError = (errorLike) => {
		const message = errorLike?.message || String(errorLike || "");
		return message.toLowerCase().includes("extension context invalidated");
	};

	const isNoResponsePortClosedError = (errorLike) => {
		const message = (
			errorLike?.message || String(errorLike || "")
		).toLowerCase();
		return message.includes(
			"the message port closed before a response was received",
		);
	};

	if (!chrome?.runtime?.id) {
		markContextInvalidated();
		return;
	}

	try {
		chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
			if (!chrome.runtime.lastError) {
				return;
			}

			if (isContextInvalidatedError(chrome.runtime.lastError)) {
				markContextInvalidated();
				return;
			}

			if (isNoResponsePortClosedError(chrome.runtime.lastError)) {
				// OPEN_SIDE_PANEL is a fire-and-forget message; no response is expected.
				return;
			}

			console.warn(
				"[Albert Enhancer] Failed to request side panel open",
				chrome.runtime.lastError.message,
			);
		});
	} catch (error) {
		if (isContextInvalidatedError(error)) {
			markContextInvalidated();
			return;
		}

		console.warn("[Albert Enhancer] Failed to request side panel open", error);
	}
}
