// Background service worker for Albert Course Planner

import { initializeStorage, getProfessorRatings } from "./course-storage.js";
import { STORAGE_KEYS } from "./utils/constants.js";
import {
	normalizeProfessorName,
	searchNyuProfessorMatch,
} from "./rmp-service.js";

const INSTRUCTOR_TBA_PATTERN = /^(TBA|to be announced)$/i;

const PANEL_PATH = "src/popup.html?mode=sidepanel";
const WEEKLY_VIEW_PATH = "src/weekly-view.html";
const ALLOWED_SIDE_PANEL_HOSTS = ["sis.portal.nyu.edu", "sis.nyu.edu"];
const RMP_PROFESSOR_CACHE_KEY = "rmpProfessorCache";
const RMP_CACHE_VERSION = "rmp:v3";
const RMP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const hasSidePanelApi = Boolean(chrome.sidePanel);

console.log("[Albert Enhancer] Background service worker started");

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function isBenignTabsError(error) {
	if (!error?.message) {
		return false;
	}
	return (
		error.message.includes("No tab with id") ||
		error.message.includes("Tabs cannot be edited") ||
		error.message.includes("Tab was closed")
	);
}

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async (details) => {
	console.log("[Albert Enhancer] Extension installed:", details.reason);
	try {
		await initializeStorage();
		await setupContextMenus();
	} catch (error) {
		console.error("[Albert Enhancer] Install initialization failed:", error);
	}

	if (hasSidePanelApi) {
		try {
			await chrome.sidePanel.setPanelBehavior({
				openPanelOnActionClick: true,
			});
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				await configureSidePanelForTab(tab.id, tab.url);
			}
		} catch (error) {
			console.error(
				"[Albert Enhancer] Failed to initialize side panel:",
				error,
			);
		}
	}
});

chrome.runtime.onStartup.addListener(async () => {
	try {
		await initializeStorage();
		await setupContextMenus();
	} catch (error) {
		console.error("[Albert Enhancer] Startup initialization failed:", error);
	}
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || typeof message.type !== "string") {
		return false;
	}

	console.log("[Albert Enhancer] Message received:", message.type);

	switch (message.type) {
		case "OPEN_PLANNER":
			openPlannerPage().catch((error) => {
				console.error("[Albert Enhancer] Failed to open planner page:", error);
			});
			break;

		case "OPEN_WEEKLY_VIEW":
			openWeeklyView().catch((error) => {
				console.error("[Albert Enhancer] Failed to open weekly view:", error);
			});
			break;

		case "OPEN_SIDE_PANEL":
			if (sender.tab?.id) {
				openSidePanel(sender.tab.id).catch((error) => {
					console.error("[Albert Enhancer] Failed to open side panel:", error);
				});
			}
			break;

		case "GET_COURSES":
			// Return courses to requester
			handleGetCourses()
				.then((courses) => sendResponse(courses))
				.catch((error) => {
					console.error("[Albert Enhancer] Failed to get courses:", error);
					sendResponse([]);
				});
			return true; // Keep channel open for async response

		case "LOOKUP_RMP_PROFESSOR":
			handleLookupRmpProfessor(message)
				.then((result) => sendResponse(result))
				.catch((error) => {
					console.error("[Albert Enhancer] Failed to lookup RMP professor:", error);
					sendResponse({
						success: false,
						status: "error",
						data: null,
						candidates: [],
						error: error.message || "Unable to lookup professor rating.",
					});
				});
			return true;

		default:
			console.log("[Albert Enhancer] Unknown message type:", message.type);
	}
});

if (hasSidePanelApi) {
	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		const nextUrl = changeInfo.url || tab?.url;
		if (nextUrl) {
			configureSidePanelForTab(tabId, nextUrl).catch((error) => {
				if (!isBenignTabsError(error)) {
					console.error(
						"[Albert Enhancer] Failed to configure side panel on tab update:",
						error,
					);
				}
			});
		}
	});

	chrome.tabs.onActivated.addListener(async ({ tabId }) => {
		try {
			const tab = await chrome.tabs.get(tabId);
			await configureSidePanelForTab(tabId, tab.url);
		} catch (error) {
			if (!isBenignTabsError(error)) {
				console.error(
					"[Albert Enhancer] Failed to handle tab activation:",
					error,
				);
			}
		}
	});
}

// ============ Message Handlers ============

async function handleGetCourses() {
	const result = await chrome.storage.local.get("courses");
	return result.courses || [];
}

async function getRmpProfessorCache() {
	const result = await chrome.storage.local.get(RMP_PROFESSOR_CACHE_KEY);
	const cache = result[RMP_PROFESSOR_CACHE_KEY];
	return cache && typeof cache === "object" ? cache : {};
}

async function readCachedRmpProfessor(cacheKey) {
	const cache = await getRmpProfessorCache();
	const cached = cache[cacheKey];

	if (!cached) {
		return { hit: false, value: null };
	}
	if (typeof cached.expiresAt !== "number" || Date.now() >= cached.expiresAt) {
		const { [cacheKey]: _expired, ...nextCache } = cache;
		await chrome.storage.local.set({ [RMP_PROFESSOR_CACHE_KEY]: nextCache });
		return { hit: false, value: null };
	}

	return { hit: true, value: cached.value ?? null };
}

async function writeCachedRmpProfessor(cacheKey, value) {
	const cache = await getRmpProfessorCache();
	await chrome.storage.local.set({
		[RMP_PROFESSOR_CACHE_KEY]: {
			...cache,
			[cacheKey]: {
				value,
				expiresAt: Date.now() + RMP_CACHE_TTL_MS,
			},
		},
	});
}

function getRmpCourseContext({ course, courseCode, courseTitle }) {
	return {
		courseCode:
			typeof course?.courseCode === "string" ? course.courseCode : courseCode || "",
		courseTitle:
			typeof course?.title === "string" ? course.title : courseTitle || "",
	};
}

function buildRmpCacheKey({ professorName, courseCode = "" }) {
	return [RMP_CACHE_VERSION, normalizeProfessorName(professorName).toLowerCase(), courseCode || ""]
		.filter(Boolean)
		.join("|");
}

// Resolve an RMP match through the shared cache, falling back to a live search.
async function resolveRmpMatch({
	professorName,
	course,
	courseCode = "",
	courseTitle = "",
}) {
	const normalizedName = normalizeProfessorName(professorName);
	if (!normalizedName) {
		return null;
	}
	const courseContext = getRmpCourseContext({ course, courseCode, courseTitle });

	const cacheKey = buildRmpCacheKey({
		professorName: normalizedName,
		courseCode: courseContext.courseCode,
	});
	const cached = await readCachedRmpProfessor(cacheKey);
	if (cached.hit) {
		return cached.value;
	}

	const match = await searchNyuProfessorMatch({
		professorName: normalizedName,
		...courseContext,
	});
	await writeCachedRmpProfessor(cacheKey, match);
	return match;
}

function isRealInstructor(name) {
	return isNonEmptyString(name) && !INSTRUCTOR_TBA_PATTERN.test(name.trim());
}

async function handleLookupRmpProfessor(message) {
	const professorName = normalizeProfessorName(message.professorName);
	if (!isRealInstructor(professorName)) {
		return {
			success: false,
			status: "not_found",
			data: null,
			candidates: [],
			error: "Professor name is required.",
		};
	}

	const match = await resolveRmpMatch({
		professorName,
		course: message.course,
		courseCode: message.courseCode,
		courseTitle: message.courseTitle,
	});

	return {
		success: match?.status === "matched",
		status: match?.status || "not_found",
		data: match?.professor || null,
		candidates: match?.status === "ambiguous" ? [] : match?.candidates || [],
		error:
			match?.status === "matched"
				? null
				: `No confident NYU RMP match found for ${professorName}.`,
	};
}

function collectInstructorLookups(courses) {
	const lookups = new Map();
	for (const course of courses) {
		for (const component of course.components || []) {
			const name = component.instructor?.trim();
			if (!isRealInstructor(name) || lookups.has(name)) {
				continue;
			}
			lookups.set(name, {
				professorName: name,
				courseCode: typeof course.courseCode === "string" ? course.courseCode : "",
				courseTitle: typeof course.title === "string" ? course.title : "",
			});
		}
	}
	return lookups;
}

async function enrichProfessorRatingsFromCourses(courses) {
	const lookups = collectInstructorLookups(courses);
	if (lookups.size === 0) return;

	const existingRatings = await getProfessorRatings();
	const resolvedRatings = {};

	for (const [name, context] of lookups) {
		if (existingRatings[name] != null) continue;
		try {
			const match = await resolveRmpMatch(context);
			const avgRating = Number(match?.professor?.avgRating);
			if (match?.status === "matched" && Number.isFinite(avgRating) && avgRating > 0) {
				resolvedRatings[name] = avgRating;
			}
		} catch (error) {
			console.error("[Albert Enhancer] RMP rating lookup failed for", name, error);
		}
	}

	if (Object.keys(resolvedRatings).length === 0) return;

	const latestRatings = await getProfessorRatings();
	await chrome.storage.local.set({
		[STORAGE_KEYS.PROFESSOR_RATINGS]: { ...resolvedRatings, ...latestRatings },
	});
}

chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace !== "local" || !changes.courses) return;
	const courses = changes.courses.newValue;
	if (!Array.isArray(courses) || courses.length === 0) return;
	enrichProfessorRatingsFromCourses(courses).catch((error) => {
		console.error("[Albert Enhancer] Failed to enrich professor ratings:", error);
	});
});

async function openPlannerPage() {
	await chrome.tabs.create({
		url: chrome.runtime.getURL(WEEKLY_VIEW_PATH),
	});
}

async function openWeeklyView() {
	await chrome.tabs.create({
		url: chrome.runtime.getURL(WEEKLY_VIEW_PATH),
	});
}

function isAllowedSidePanelUrl(urlString) {
	try {
		const url = new URL(urlString);
		return ALLOWED_SIDE_PANEL_HOSTS.includes(url.hostname);
	} catch (error) {
		return false;
	}
}

async function configureSidePanelForTab(tabId, url) {
	if (!hasSidePanelApi || !tabId || !url) {
		return;
	}

	const shouldEnable = isAllowedSidePanelUrl(url);

	try {
		await chrome.sidePanel.setOptions(
			shouldEnable
				? {
						tabId,
						path: PANEL_PATH,
						enabled: true,
					}
				: {
						tabId,
						enabled: false,
					},
		);
	} catch (error) {
		console.error("[Albert Enhancer] Failed to configure side panel:", error);
	}
}

async function openSidePanel(tabId) {
	if (!hasSidePanelApi || !tabId) {
		return;
	}

	try {
		await chrome.sidePanel.open({ tabId });
	} catch (error) {
		console.error("[Albert Enhancer] Failed to open side panel:", error);
	}
}

// ============ Context Menu ============

function removeAllContextMenus() {
	return new Promise((resolve) => {
		chrome.contextMenus.removeAll(() => {
			if (chrome.runtime.lastError) {
				console.warn(
					"[Albert Enhancer] Failed to clear context menus:",
					chrome.runtime.lastError.message,
				);
			}
			resolve();
		});
	});
}

function createContextMenu(menuConfig) {
	return new Promise((resolve) => {
		chrome.contextMenus.create(menuConfig, () => {
			if (chrome.runtime.lastError) {
				console.error(
					"[Albert Enhancer] Failed to create context menu:",
					menuConfig.id,
					chrome.runtime.lastError.message,
				);
			}
			resolve();
		});
	});
}

async function setupContextMenus() {
	await removeAllContextMenus();
	await createContextMenu({
		id: "open-planner",
		title: "Open Course Planner",
		contexts: ["action"],
	});
	await createContextMenu({
		id: "clear-courses",
		title: "Clear All Courses",
		contexts: ["action"],
	});
}

chrome.contextMenus.onClicked.addListener(async (info) => {
	switch (info.menuItemId) {
		case "open-planner":
			await openPlannerPage();
			break;

		case "clear-courses":
			await chrome.storage.local.set({
				courses: [],
				plannerSelection: [],
				activeTerm: null,
			});
			await chrome.action.setBadgeText({ text: "" });
			console.log("[Albert Enhancer] All courses cleared");
			break;
	}
});

// ============ Keyboard Shortcuts ============

chrome.commands.onCommand.addListener((command) => {
	console.log("[Albert Enhancer] Command:", command);

	switch (command) {
		case "open-planner":
			openPlannerPage();
			break;
	}
});
