// Content script for Albert pages.
// Owns Chrome messaging and page controls.

import { parseAlbertPage } from "./albert-intake.js";
import * as parsers from "../shared/time-parser.js";

const DEBUG = true;
const debugLog = (...args) => {
	if (DEBUG) {
		console.log("[Albert Enhancer]", ...args);
	}
};

debugLog("Content script loaded at", window.location.href);

const INTAKE_TARGET_SELECTORS = {
	SUMMARY_TERM_WRAPPER: ".isSSS_ShCtTermWrp",
	SUMMARY_CART_TABLE: "table.isSSS_ShCtTable.accordion-table",
	SUMMARY_PRIMARY_ROW: "tr.isSSS_ShCtPrim",
	CART_TABLE: 'table.ps_grid-flex[title*="Shopping Cart"]',
};

const DRAWER_IDS = {
	toggle: "albert-planner-toggle",
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
	let table = document.querySelector(INTAKE_TARGET_SELECTORS.CART_TABLE);
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

	table = fallbackTables.find((candidate) => {
		const title =
			candidate.getAttribute("title") ||
			candidate.getAttribute("summary") ||
			"";
		return title.toLowerCase().includes("shopping cart");
	});

	if (!table) {
		debugLog(
			"ps_grid-flex tables found but none mention 'Shopping Cart':",
			fallbackTables.map((candidate, idx) => ({
				idx,
				title: candidate.getAttribute("title"),
				summary: candidate.getAttribute("summary"),
				className: candidate.className,
			})),
		);
	}

	return table || null;
}

function findSummaryCartTable() {
	const selectedWrapper = document.querySelector(
		`${INTAKE_TARGET_SELECTORS.SUMMARY_TERM_WRAPPER}.selected`,
	);
	if (selectedWrapper) {
		return (
			selectedWrapper.querySelector(INTAKE_TARGET_SELECTORS.SUMMARY_CART_TABLE) ||
			selectedWrapper
		);
	}

	const tables = Array.from(
		document.querySelectorAll(INTAKE_TARGET_SELECTORS.SUMMARY_CART_TABLE),
	);
	return (
		tables.find((table) =>
			table.querySelector(INTAKE_TARGET_SELECTORS.SUMMARY_PRIMARY_ROW),
		) || null
	);
}

function findEnrolledTable() {
	return document.getElementById("isSSS_ShCtSchTable");
}

// ============ Message Listener ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type !== "PARSE_CART") {
		return false;
	}

	const isLikelyCartUrl = /NYU_SSENRL_CART/i.test(window.location.href);
	const cartTable = findSummaryCartTable() || findCartTable();
	const enrolledTable = findEnrolledTable();

	if (!cartTable && !enrolledTable && !isLikelyCartUrl) {
		debugLog("Skipping parse request in non-cart frame", window.location.href);
		return false;
	}

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
		const result = parseAlbertPage({
			cartTable,
			enrolledTable,
			parsers,
			logger: debugLog,
		});
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

	toggle.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
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
