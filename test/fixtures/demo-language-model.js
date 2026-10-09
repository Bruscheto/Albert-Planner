// Harness-only stand-in for Chrome's built-in LanguageModel, so the goal box
// can be demoed and browser-checked without on-device AI. It recognizes a few
// phrasings with regular expressions; it is not the product's interpreter.
// Choose its state with ?ai=available|downloadable|unavailable|none.
(function () {
	const mode = new URLSearchParams(location.search).get("ai") || "available";
	if (mode === "none") return;
	const DAY_WORDS = {
		monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
		friday: "Fri", saturday: "Sat", sunday: "Sun",
	};
	let state = mode;

	function interpret(input) {
		const { goalText, courses } = JSON.parse(input);
		const text = goalText.toLowerCase();
		const patch = {
			maxCredits: null, earliestMinutes: null, unavailableDays: null,
			lockedCourseIds: null, excludedCourseIds: null,
		};
		const unresolvedGoals = [];
		const clarificationQuestions = [];

		const days = Object.entries(DAY_WORDS)
			.filter(([word]) => new RegExp(`no ${word}s?|${word}s? off|not on ${word}s?`).test(text))
			.map(([, day]) => day);
		if (days.length) patch.unavailableDays = days;

		const before = text.match(/(?:nothing|no classes?) (?:before|until) (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
		if (before) {
			let hours = Number(before[1]);
			if (before[3] === "pm" && hours < 12) hours += 12;
			if (!before[3] && hours < 7) hours += 12;
			patch.earliestMinutes = hours * 60 + Number(before[2] || 0);
		}

		const credits = text.match(/(?:at most|max(?:imum)?|no more than|under) (\d{1,2}(?:\.5)?) credits?/);
		if (credits) patch.maxCredits = Number(credits[1]);

		const codes = goalText.match(/[A-Z]{2,6}-[A-Z]{2} \d{1,4}/g) || [];
		const locked = [];
		for (const code of codes) {
			const matches = courses.filter((course) => course.courseCode === code);
			if (matches.length === 1) locked.push(matches[0].id);
			else if (matches.length > 1) {
				clarificationQuestions.push(`Which section of ${code} should be required: ${matches.map((m) => m.section).join(" or ")}?`);
			}
		}
		if (/\bkeep math\b|\bmath\b/.test(text) && !codes.length) {
			const math = courses.filter((course) => /^MATH/.test(course.courseCode));
			if (math.length > 1) {
				clarificationQuestions.push(`Several math courses match: ${math.map((m) => `${m.courseCode} · ${m.section}`).join(", ")}. Which one should be required?`);
			} else if (math.length === 1) locked.push(math[0].id);
		}
		if (locked.length) patch.lockedCourseIds = locked;

		if (/prepare|career|good for|useful for|\bml\b|machine learning/.test(text)) {
			unresolvedGoals.push("Whether a course prepares you for that goal can't be judged: course-content evidence is unavailable.");
		}
		if (/finish by|done by|end by/.test(text)) {
			unresolvedGoals.push("A latest end time isn't a supported rule yet; only an earliest start can be set.");
		}
		return JSON.stringify({ constraintPatch: patch, unresolvedGoals, clarificationQuestions });
	}

	window.__demoLanguageModel = {
		async availability() {
			return state;
		},
		async create(options = {}) {
			if (state === "downloadable" || state === "downloading") {
				state = "downloading";
				const target = new EventTarget();
				options.monitor?.(target);
				for (let step = 0; step <= 10; step += 1) {
					await new Promise((resolve) => setTimeout(resolve, 120));
					const event = new Event("downloadprogress");
					event.loaded = step / 10;
					target.dispatchEvent(event);
				}
				state = "available";
			}
			if (state === "unavailable") throw new Error("NotSupportedError");
			return {
				async prompt(input, { signal } = {}) {
					await new Promise((resolve, reject) => {
						const timer = setTimeout(resolve, 650);
						signal?.addEventListener("abort", () => {
							clearTimeout(timer);
							reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
						});
					});
					return interpret(input);
				},
				destroy() {},
			};
		},
	};
})();
