// On-device AI check for the hardware spike (task 1.1): reports whether this
// computer can run the goal box and, if the model is ready, times one
// interpretation of a synthetic goal. It never starts a model download.

import {
	checkAvailability,
	interpretGoal,
} from "./goal-interpreter.js";

const SAMPLE_GOAL = "no Friday classes, nothing before 10, at most 16 credits";

const SAMPLE_COURSES = [
	{ id: "sample-1", courseCode: "CSCI-UA 201", section: "001", title: "Computer Systems Organization", credits: 4, components: [] },
	{ id: "sample-2", courseCode: "MATH-UA 121", section: "002", title: "Calculus I", credits: 4, components: [] },
];

const SAMPLE_RULES = {
	maxCredits: 18,
	earliestMinutes: 0,
	unavailableDays: [],
	lockedCourseIds: [],
	excludedCourseIds: [],
};

/**
 * @param {object | null} languageModel
 * @param {{ now?: () => number, browser?: string }} [options]
 * @returns {Promise<{ availability: string, browser: string, ran: boolean, latencyMs?: number, matched?: boolean, error?: string }>}
 */
export async function runAiCheck(languageModel, { now = () => performance.now(), browser = describeBrowser() } = {}) {
	const availability = await checkAvailability(languageModel);
	const report = { availability, browser, ran: false };
	if (availability !== "available") return report;

	const started = now();
	try {
		const proposal = await interpretGoal({
			languageModel,
			goalText: SAMPLE_GOAL,
			constraints: SAMPLE_RULES,
			courses: SAMPLE_COURSES,
		});
		const rules = proposal.proposedConstraints;
		report.matched =
			rules.maxCredits === 16 &&
			rules.earliestMinutes === 600 &&
			rules.unavailableDays.length === 1 &&
			rules.unavailableDays[0] === "Fri";
	} catch (error) {
		report.error = error.code ?? "failed";
	}
	report.ran = true;
	report.latencyMs = Math.round(now() - started);
	return report;
}

export function formatAiCheck(report) {
	const lines = [
		`on-device AI: ${report.availability}`,
		`browser: ${report.browser}`,
	];
	if (report.ran) {
		lines.push(`sample goal: ${report.error ? `failed (${report.error})` : report.matched ? "interpreted correctly" : "interpreted, but not as expected"}`);
		lines.push(`latency: ${report.latencyMs} ms`);
	} else if (report.availability === "downloadable") {
		lines.push("sample goal: not run (model not downloaded)");
	}
	return lines.join("\n");
}

function describeBrowser() {
	const brands = globalThis.navigator?.userAgentData?.brands ?? [];
	const chrome = brands.find((brand) => /Chrome|Chromium/.test(brand.brand));
	const platform = globalThis.navigator?.userAgentData?.platform ?? "";
	const memory = globalThis.navigator?.deviceMemory;
	return [chrome ? `${chrome.brand} ${chrome.version}` : "unknown browser", platform, memory ? `≥${memory} GB RAM reported` : ""]
		.filter(Boolean)
		.join(" · ");
}
