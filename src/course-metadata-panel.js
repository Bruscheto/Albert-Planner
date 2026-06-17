import { setProfessorRating } from "./course-storage.js";
import { formatTime } from "./utils/time-parser.js";

function getPrimaryComponent(course) {
	return (
		course?.components?.find(
			(component) => component?.type?.toLowerCase() === "lecture",
		) ||
		course?.components?.[0] ||
		null
	);
}

function getInstructors(course) {
	if (!course?.components) return [];
	const seen = new Set();
	const names = [];
	for (const comp of course.components) {
		const name = comp.instructor?.trim();
		if (name && !/^(TBA|to be announced)$/i.test(name) && !seen.has(name)) {
			seen.add(name);
			names.push(name);
		}
	}
	return names;
}

const rmpInsightCache = new Map();
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

export function ratingTier(val) {
	if (val >= 4) return "good";
	if (val >= 3) return "mid";
	return "low";
}

function formatMetaLine(component) {
	const parts = [];
	if (component?.timeRange) {
		const dayLabel =
			Array.isArray(component.days) && component.days.length
				? component.days.join("/")
				: "Days TBA";
		parts.push(
			`${dayLabel} ${formatTime(component.timeRange.start)}\u2009\u2013\u2009${formatTime(component.timeRange.end)}`,
		);
	} else {
		parts.push("Time TBA");
	}
	return parts.join(" \u00B7 ");
}

function formatLocation(component) {
	const room = component?.room?.trim();
	if (!room || /^(TBA|to be announced)$/i.test(room)) {
		return "";
	}
	return room;
}

function buildStatusTags(context) {
	const {
		isPlanned = false,
		online = false,
		scheduledDays = [],
		conflictCodes = [],
		missingTypes = [],
	} = context;

	const tags = [];

	if (isPlanned && scheduledDays.length > 0) {
		tags.push({
			text: `Scheduled \u00B7 ${scheduledDays.join("/")}`,
			cls: "status-scheduled",
		});
	} else if (!isPlanned) {
		tags.push({ text: "Not scheduled", cls: "status-neutral" });
	}

	if (online) {
		tags.push({ text: "~online", cls: "status-online" });
	}

	if (isPlanned && conflictCodes.length > 0) {
		tags.push({
			text: `Conflicts with ${conflictCodes.join(", ")}`,
			cls: "status-conflict",
		});
	} else if (isPlanned) {
		tags.push({ text: "No conflicts", cls: "status-ok" });
	}

	for (const type of missingTypes) {
		tags.push({ text: `${type} not scheduled`, cls: "status-warn" });
	}

	if (tags.length === 0) return null;

	const container = document.createElement("div");
	container.className = "metadata-status-tags";
	for (const tag of tags) {
		const el = document.createElement("span");
		el.className = `metadata-status-tag ${tag.cls}`;
		el.textContent = tag.text;
		container.appendChild(el);
	}
	return container;
}

function createBucketOption(bucket, isActive, onBucketSelect) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "metadata-bucket-option";
	if (isActive) {
		button.classList.add("is-active");
	}

	const dot = document.createElement("span");
	dot.className = "metadata-bucket-dot";
	if (bucket.color) {
		dot.style.backgroundColor = bucket.color;
	}

	const labelWrap = document.createElement("span");
	labelWrap.className = "metadata-bucket-copy";

	const name = document.createElement("span");
	name.className = "metadata-bucket-name";
	name.textContent = bucket.name;
	labelWrap.appendChild(name);

	if (bucket.description) {
		const helper = document.createElement("span");
		helper.className = "metadata-bucket-helper";
		helper.textContent = bucket.description;
		labelWrap.appendChild(helper);
	}

	const indicator = document.createElement("span");
	indicator.className = "metadata-bucket-indicator";
	indicator.setAttribute("aria-hidden", "true");

	button.setAttribute("aria-pressed", String(isActive));
	button.append(dot, labelWrap, indicator);
	button.addEventListener("click", () => onBucketSelect(bucket.id ?? null));
	return button;
}

function formatMetric(value, digits = 1) {
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) {
		return "n/a";
	}
	return num.toFixed(digits);
}

function formatPercent(value) {
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) {
		return "n/a";
	}
	return `${num.toFixed(0)}%`;
}

function formatReviewDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getRmpCacheKey(professorName, course) {
	return [
		professorName.trim().toLowerCase(),
		course?.id || "",
		course?.courseCode || "",
	]
		.filter(Boolean)
		.join("|");
}

async function lookupRmpProfessor(professorName, course) {
	const key = getRmpCacheKey(professorName, course);
	if (!rmpInsightCache.has(key)) {
		rmpInsightCache.set(
			key,
			chrome.runtime.sendMessage({
				type: "LOOKUP_RMP_PROFESSOR",
				professorName,
				course,
			}),
		);
	}
	return rmpInsightCache.get(key);
}

function renderInsightLoading(panel, professorName) {
	panel.innerHTML = "";
	const status = document.createElement("div");
	status.className = "metadata-prof-insight-status";
	status.textContent = `Looking up ${professorName}`;
	panel.appendChild(status);
}

function renderInsightNotFound(panel) {
	panel.innerHTML = "";
	const status = document.createElement("div");
	status.className = "metadata-prof-insight-status";
	status.textContent = "RMP match not found";
	const helper = document.createElement("div");
	helper.className = "metadata-prof-insight-helper";
	helper.textContent = "Use the local rating badge if you want to track this professor.";
	panel.append(status, helper);
}

function createInsightStat(label, value) {
	const stat = document.createElement("div");
	stat.className = "metadata-prof-insight-stat";
	const valueEl = document.createElement("div");
	valueEl.className = "metadata-prof-insight-stat-value";
	valueEl.textContent = value;
	const labelEl = document.createElement("div");
	labelEl.className = "metadata-prof-insight-stat-label";
	labelEl.textContent = label;
	stat.append(valueEl, labelEl);
	return stat;
}

function renderInsightMatched(panel, professor, course) {
	panel.innerHTML = "";

	const header = document.createElement("div");
	header.className = "metadata-prof-insight-header";

	const identity = document.createElement("div");
	const name = document.createElement("div");
	name.className = "metadata-prof-insight-name";
	name.textContent = professor.name || "Professor";
	const source = document.createElement("div");
	source.className = "metadata-prof-insight-source";
	source.textContent = "Rate My Professors · NYU";
	identity.append(name, source);

	const score = document.createElement("div");
	score.className = `metadata-prof-insight-score rating-${ratingTier(Number(professor.avgRating) || 0)}`;
	score.textContent = formatMetric(professor.avgRating);

	header.append(identity, score);

	const stats = document.createElement("div");
	stats.className = "metadata-prof-insight-stats";
	stats.append(
		createInsightStat("Difficulty", formatMetric(professor.avgDifficulty)),
		createInsightStat("Would take again", formatPercent(professor.wouldTakeAgainPercent)),
		createInsightStat("Ratings", formatMetric(professor.numRatings, 0)),
	);

	const review = document.createElement("div");
	review.className = "metadata-prof-insight-review";
	const reviewTitle = document.createElement("div");
	reviewTitle.className = "metadata-prof-insight-review-title";
	reviewTitle.textContent = `Latest for ${course?.courseCode || "this course"}`;
	review.appendChild(reviewTitle);

	const sameCourseRating = professor.sameCourseRating;
	if (sameCourseRating?.comment) {
		const metaParts = [
			formatReviewDate(sameCourseRating.date),
			sameCourseRating.grade ? `Grade ${sameCourseRating.grade}` : "",
			Number.isFinite(Number(sameCourseRating.difficultyRating))
				? `Difficulty ${formatMetric(sameCourseRating.difficultyRating)}`
				: "",
		].filter(Boolean);

		const meta = document.createElement("div");
		meta.className = "metadata-prof-insight-review-meta";
		meta.textContent = metaParts.join(" · ");

		const comment = document.createElement("blockquote");
		comment.className = "metadata-prof-insight-comment";
		comment.textContent = sameCourseRating.comment.trim();
		review.append(meta, comment);
	} else {
		const empty = document.createElement("div");
		empty.className = "metadata-prof-insight-helper";
		empty.textContent = "No same-course comment found.";
		review.appendChild(empty);
	}

	panel.append(header, stats, review);
}

function makeDotNumber(text) {
	const dot = document.createElement("span");
	dot.className = "metadata-prof-rating-dot";
	return [dot, document.createTextNode(text)];
}

function updateRmpBadge(badge, result, manualRating) {
	badge.classList.remove("has-value", "rating-good", "rating-mid", "rating-low");
	badge.replaceChildren();

	const rmpRating = Number(result?.data?.avgRating);
	if (result?.status === "matched" && Number.isFinite(rmpRating) && rmpRating > 0) {
		badge.classList.add("has-value", `rating-${ratingTier(rmpRating)}`);
		badge.replaceChildren(...makeDotNumber(rmpRating.toFixed(1)));
		badge.title = "RMP rating";
		badge.dataset.source = "rmp";
		return;
	}

	if (manualRating != null) {
		const num = Number(manualRating);
		badge.classList.add("has-value", `rating-${ratingTier(num)}`);
		badge.replaceChildren(...makeDotNumber(num.toFixed(1)));
		badge.title = `Local rating: ${manualRating}/5 - click to edit`;
	} else {
		badge.textContent = "~";
		badge.title = "Add local rating";
	}
	badge.dataset.source = "local";
}

function renderRmpInsightPanel(panel, result, course) {
	if (result?.status === "matched" && result.data) {
		renderInsightMatched(panel, result.data, course);
		return;
	}
	renderInsightNotFound(panel);
}

function createProfessorInsightEntry({ professorName, course, manualRating }) {
	const entry = document.createElement("span");
	entry.className = "metadata-instructor-entry";

	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.className = "metadata-instructor-trigger";
	trigger.textContent = professorName;
	trigger.setAttribute("aria-haspopup", "dialog");
	trigger.setAttribute("aria-expanded", "false");

	const badge = document.createElement("span");
	badge.className = "metadata-prof-rating";
	updateRmpBadge(badge, null, manualRating);
	badge.addEventListener("click", (event) => {
		if (badge.dataset.source === "rmp") {
			return;
		}
		event.stopPropagation();
		showRatingInput(badge, professorName, manualRating);
	});

	const panelWrapper = document.createElement("div");
	panelWrapper.className = "metadata-prof-insight-wrapper";

	const panel = document.createElement("div");
	panel.className = "metadata-prof-insight";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", `${professorName} RMP details`);
	renderInsightLoading(panel, professorName);
	panelWrapper.appendChild(panel);

	let openTimer = null;
	let closeTimer = null;
	let hasLoaded = false;

	const cancelClose = () => {
		clearTimeout(closeTimer);
	};

	const openPanel = () => {
		cancelClose();
		clearTimeout(openTimer);
		openTimer = setTimeout(async () => {
			entry.classList.add("is-open");
			trigger.setAttribute("aria-expanded", "true");
			if (hasLoaded) {
				return;
			}
			hasLoaded = true;
			renderInsightLoading(panel, professorName);
			try {
				const result = await lookupRmpProfessor(professorName, course);
				renderRmpInsightPanel(panel, result, course);
			} catch (error) {
				console.error("[Albert Enhancer] RMP insight lookup failed:", error);
				renderInsightNotFound(panel);
			}
		}, OPEN_DELAY_MS);
	};

	const closePanel = () => {
		clearTimeout(openTimer);
		closeTimer = setTimeout(() => {
			if (entry.matches(":hover") || panelWrapper.matches(":hover")) {
				return;
			}
			entry.classList.remove("is-open");
			trigger.setAttribute("aria-expanded", "false");
		}, CLOSE_DELAY_MS);
	};

	entry.addEventListener("pointerenter", cancelClose);
	trigger.addEventListener("pointerenter", openPanel);
	entry.addEventListener("pointerleave", closePanel);
	panelWrapper.addEventListener("pointerenter", cancelClose);
	panelWrapper.addEventListener("pointerleave", closePanel);
	trigger.addEventListener("focus", openPanel);
	entry.addEventListener("focusout", (event) => {
		if (!entry.contains(event.relatedTarget)) {
			closePanel();
		}
	});
	trigger.addEventListener("click", (event) => {
		event.preventDefault();
		if (entry.classList.contains("is-open")) {
			closePanel();
		} else {
			openPanel();
		}
	});

	entry.append(trigger, badge, panelWrapper);
	return entry;
}

function showRatingInput(badge, profName, currentVal) {
	if (badge.querySelector("input")) return;

	const rect = badge.getBoundingClientRect();
	badge.style.width = `${Math.max(rect.width, 38)}px`;
	badge.style.height = `${rect.height}px`;

	const input = document.createElement("input");
	input.type = "number";
	input.className = "metadata-prof-rating-input";
	input.min = "0";
	input.max = "5";
	input.step = "0.1";
	input.value = currentVal != null ? currentVal : "";
	input.placeholder = "0–5";

	badge.textContent = "";
	badge.appendChild(input);
	input.focus();
	input.select();

	input.addEventListener("wheel", (e) => e.preventDefault(), {
		passive: false,
	});

	const commit = async () => {
		const raw = input.value.trim();
		badge.classList.remove("rating-good", "rating-mid", "rating-low");
		if (raw === "") {
			await setProfessorRating(profName, null);
			badge.classList.remove("has-value");
			badge.textContent = "~";
			badge.title = "Add rating";
		} else {
			const val = Math.min(5, Math.max(0, parseFloat(raw) || 0));
			await setProfessorRating(profName, val);
			badge.classList.add("has-value", `rating-${ratingTier(val)}`);
			badge.replaceChildren(...makeDotNumber(val.toFixed(1)));
			badge.title = `Rating: ${val}/5 — click to edit`;
		}
		badge.style.width = "";
		badge.style.height = "";
		document.dispatchEvent(new CustomEvent("professor-ratings-changed"));
	};

	input.addEventListener("blur", commit);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			input.blur();
		}
		if (e.key === "Escape") {
			input.value = currentVal != null ? currentVal : "";
			input.blur();
		}
	});
}

export function renderCourseMetadataContent({
	container,
	course,
	buckets,
	context = {},
	ratings = {},
	focusComponent = null,
	onBucketSelect,
}) {
	if (!container) return;

	container.innerHTML = "";

	if (!course) {
		container.innerHTML = `
			<div class="metadata-empty-state">
				<h3>No course selected</h3>
				<p>Pick a course to organize it and add more metadata later.</p>
			</div>
		`;
		return;
	}

	const summary = document.createElement("div");
	summary.className = "metadata-summary";

	const displayComponent = focusComponent || getPrimaryComponent(course);
	const section = displayComponent?.section ?? course.section;
	const sectionMarkup = section
		? ` <span class="metadata-course-section">· ${section}</span>`
		: "";

	const headline = document.createElement("div");
	headline.className = "metadata-headline";
	headline.innerHTML = `
		<h2 class="metadata-course-code">${course.courseCode}${sectionMarkup}</h2>
		<span class="metadata-credit-pill">${course.credits ?? "-"} cr</span>
	`;

	const title = document.createElement("p");
	title.className = "metadata-course-title";
	title.textContent = course.title || "Untitled Course";

	const meta = document.createElement("p");
	meta.className = "metadata-meta-line";
	meta.textContent = formatMetaLine(displayComponent);

	summary.append(headline, title, meta);

	const location = formatLocation(displayComponent);
	if (location) {
		const locationLine = document.createElement("p");
		locationLine.className = "metadata-location-line";
		locationLine.textContent = location;
		summary.appendChild(locationLine);
	}

	const instructors = getInstructors(course);
	if (instructors.length > 0) {
		const instructorLine = document.createElement("div");
		instructorLine.className = "metadata-instructor-line";
		for (const instructor of instructors) {
			instructorLine.appendChild(
				createProfessorInsightEntry({
					professorName: instructor,
					course,
					manualRating: ratings[instructor],
				}),
			);
		}
		summary.appendChild(instructorLine);
	}

	const statusTags = buildStatusTags(context);
	if (statusTags) {
		summary.appendChild(statusTags);
	}

	const divider = document.createElement("hr");
	divider.className = "metadata-divider";

	const bucketHeading = document.createElement("div");
	bucketHeading.className = "metadata-section-heading";
	bucketHeading.textContent = "Bucket";

	const bucketList = document.createElement("div");
	bucketList.className = "metadata-bucket-list";

	const unsortedBucket = {
		id: null,
		name: "Unsorted",
		color: "#9ca3af",
		description: "Keep the course ungrouped for now",
	};

	bucketList.appendChild(
		createBucketOption(unsortedBucket, !course.bucket, onBucketSelect),
	);

	for (const bucket of buckets) {
		bucketList.appendChild(
			createBucketOption(
				bucket,
				course.bucket === bucket.id,
				onBucketSelect,
			),
		);
	}

	container.append(summary, divider, bucketHeading, bucketList);
}
