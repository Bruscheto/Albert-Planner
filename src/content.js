// Content script for Albert pages
// Parses shopping cart on-demand when requested by popup
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

// ============ Message Listener ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type !== "PARSE_CART") {
		return false;
	}

	const isLikelyCartUrl = /NYU_SSENRL_CART/i.test(window.location.href);
	const cartTable = findCartTable();

	// Not this frame's job — let the frame that actually has the cart respond.
	if (!cartTable && !isLikelyCartUrl) {
		debugLog("Skipping parse request in non-cart frame", window.location.href);
		return false;
	}

	// This frame will respond; loading the shared parser is async, so keep the
	// message channel open by returning true below.
	handleParseCart(cartTable, sendResponse);
	return true;
});

async function handleParseCart(cartTable, sendResponse) {
	try {
		if (!cartTable) {
			debugLog("No shopping cart found in this frame yet; logging tables");
			logAvailableTables();
			sendResponse({
				courses: [],
				error: "Shopping cart table not found on this page.",
			});
			return;
		}

		debugLog("Parse request received in frame", window.location.href);
		const parsers = await loadParsers();
		const courses = parseShoppingCart(cartTable, parsers);
		debugLog("Parsed", courses.length, "courses", courses);
		sendResponse({ courses });
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
