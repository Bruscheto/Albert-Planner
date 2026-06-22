import { setProfessorRating } from "../storage/course-storage.js";

function getRmpCacheKey(professorName, course) {
	return [
		professorName.trim().toLowerCase(),
		course?.id || "",
		course?.courseCode || "",
	]
		.filter(Boolean)
		.join("|");
}

function normalizeManualRating(rawValue) {
	const raw = String(rawValue ?? "").trim();
	if (raw === "") {
		return null;
	}
	return Math.min(5, Math.max(0, Number.parseFloat(raw) || 0));
}

export function createCourseMetadataEffects({
	sendMessage,
	setProfessorRating: persistProfessorRating,
	dispatchRatingChange,
}) {
	const rmpInsightCache = new Map();

	return {
		lookupRmpProfessor(professorName, course) {
			const key = getRmpCacheKey(professorName, course);
			if (!rmpInsightCache.has(key)) {
				rmpInsightCache.set(
					key,
					sendMessage({
						type: "LOOKUP_RMP_PROFESSOR",
						professorName,
						course,
					}),
				);
			}
			return rmpInsightCache.get(key);
		},

		async saveManualProfessorRating(professorName, rawValue) {
			const rating = normalizeManualRating(rawValue);
			await persistProfessorRating(professorName, rating);
			dispatchRatingChange();
			return { rating };
		},
	};
}

export const courseMetadataEffects = createCourseMetadataEffects({
	sendMessage: (message) => chrome.runtime.sendMessage(message),
	setProfessorRating,
	dispatchRatingChange: () => {
		document.dispatchEvent(new CustomEvent("professor-ratings-changed"));
	},
});
