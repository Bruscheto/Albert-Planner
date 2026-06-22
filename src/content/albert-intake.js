const SELECTORS = {
	SUMMARY_TERM_WRAPPER: ".isSSS_ShCtTermWrp",
	SUMMARY_CART_TABLE: "table.isSSS_ShCtTable.accordion-table",
	SUMMARY_PRIMARY_ROW: "tr.isSSS_ShCtPrim",
	SUMMARY_DETAIL_ROW: "tr.isSSS_ShCtNonPrim",
	CART_TABLE: 'table.ps_grid-flex[title*="Shopping Cart"]',
	CART_ROW: "tr.ps_grid-row",
	LAYOUT: "div.ps_box-group.psc_layout",
};

function parseDaysAndTime(daysTimesStr, parsers) {
	if (!daysTimesStr || daysTimesStr.toUpperCase() === "TBA") {
		return { days: [], timeRange: null, isTBA: true };
	}

	const normalized = daysTimesStr.replace(/\s+/g, " ").trim();
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
		.replace(/:\s*/g, ": ")
		.replace(/^\s*In[-\s]?Person\b:?\s*/i, "")
		.replace(/\bLoc:\s*/gi, "")
		.replace(/\s+(?:Washington Sq(?:uare)?|Brooklyn|Manhattan|Midtown)\s*$/i, "")
		.replace(/\s+/g, " ")
		.trim();
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

	const ownerDocument = anchorElement?.ownerDocument;
	return parseTermInfo(ownerDocument?.body?.innerText || "");
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

function parseSummaryCourseInfo(row, logger) {
	const cell = getSummaryCourseCell(row);
	if (!cell) return null;

	const cellText = normalizeText(cell.textContent);
	const titleFromAttribute = normalizeText(cell.getAttribute("title"));
	const pattern =
		/^(.*?)\s+([A-Z0-9&-]+-[A-Z0-9&-]+\s+\d+[A-Z]?)\s+([A-Z0-9]+)\s*\(([\d.]+)\)$/i;
	const match = cellText.match(pattern);

	if (!match) {
		logger?.(`Could not parse summary course cell: "${cellText}"`);
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

function createCourseFromSummaryRow(row, parsers, termInfo, now, logger) {
	const courseInfo = parseSummaryCourseInfo(row, logger);
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
			addedAt: now(),
			...(termInfo ? { term: termInfo } : {}),
		},
		summaryComponent,
	};
}

function parseClassCode(linkText) {
	if (!linkText || typeof linkText !== "string") {
		return null;
	}

	const patterns = [
		/Class Code:\s*([A-Z\-]+\s+\d+)-(\d+)\s*\((\d+)\)/i,
		/Class Code:\s*([^()]+?)\s*-\s*(\d+)\s*\((\d+)\)/i,
	];

	for (const pattern of patterns) {
		const match = linkText.match(pattern);
		if (match) {
			return {
				code: match[1].trim(),
				section: match[2],
				classNumber: match[3],
			};
		}
	}

	return null;
}

function parseRow(row, parsers, logger) {
	const layout = row.querySelector(SELECTORS.LAYOUT);
	if (!layout) return null;

	const layoutId = layout.id || "";
	const indexMatch = layoutId.match(/\$(\d+)$/);
	const rowIndex = indexMatch ? Number.parseInt(indexMatch[1], 10) : -1;

	const classNameSpan = layout.querySelector('[id^="P_CLASS_NAME$span"]');
	const classNameText =
		classNameSpan?.getAttribute("title") || classNameSpan?.textContent || "";
	const classInfo = parseClassCode(classNameText);

	if (!classInfo) {
		logger?.(`Could not parse class code from: "${classNameText}"`);
		return null;
	}

	const sectionEl = layout.querySelector('[id^="CLASS_TBL_VW_CLASS_SECTION"]');
	const section = sectionEl?.textContent?.trim() || classInfo.section;
	const descEl = layout.querySelector('[id^="CLASS_TBL_VW_DESCR"]');
	const description = descEl?.textContent?.trim() || "";
	const instructorEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_INSTR_LONG"]',
	);
	const instructor = instructorEl?.textContent?.trim() || "TBA";
	const daysTimesEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_MTG_SCHED_LONG"]',
	);
	const daysTimesStr = daysTimesEl?.textContent?.trim() || "TBA";
	const { days, timeRange, isTBA } = parseDaysAndTime(daysTimesStr, parsers);
	const locationEl = layout.querySelector(
		'[id^="DERIVED_REGFRM1_SSR_MTG_LOC_LONG"]',
	);
	const location = locationEl?.textContent?.trim() || "TBA";
	const unitsEl = layout.querySelector('[id^="SSR_REGFORM_VW_UNT_TAKEN"]');
	const unitsText = unitsEl?.textContent?.trim() || "";
	const units = Number.parseFloat(unitsText) || 0;
	const isRecitation =
		unitsText === "" || unitsText === "\u00A0" || units === 0;
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

function parseShoppingCart(cartTable, parsers, { logger, now }) {
	logger?.("Found cart table:", cartTable.getAttribute("title"));
	const termInfo = getPageTermInfo(cartTable);
	const rows = cartTable.querySelectorAll(SELECTORS.CART_ROW);
	logger?.("Found", rows.length, "rows in cart");

	const courses = [];
	let currentCourse = null;

	for (const row of rows) {
		const parsed = parseRow(row, parsers, logger);
		if (!parsed) continue;

		logger?.(
			`Row ${parsed.rowIndex}: ${parsed.courseCode}-${parsed.section}, units=${parsed.credits}, isRecit=${parsed.isRecitation}`,
		);

		if (parsed.isRecitation) {
			if (currentCourse && parsed.courseCode === currentCourse.courseCode) {
				currentCourse = {
					...currentCourse,
					components: [
						...currentCourse.components,
						{
							type: "Recitation",
							section: parsed.section,
							days: parsed.days,
							timeRange: parsed.timeRange,
							room: parsed.location,
							instructor: parsed.instructor,
							isTBA: parsed.isTBA,
							status: parsed.status,
						},
					],
				};
				logger?.(
					`Added recitation ${parsed.section} to ${currentCourse.courseCode}`,
				);
			} else {
				logger?.(`Orphan recitation: ${parsed.courseCode}-${parsed.section}`);
			}
			continue;
		}

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
			addedAt: now(),
			...(termInfo ? { term: termInfo } : {}),
		};

		logger?.(
			`Parsed course: ${parsed.courseCode}-${parsed.section} (${parsed.credits} credits)`,
		);
	}

	if (currentCourse) {
		courses.push(currentCourse);
	}

	return courses;
}

function parseSummaryCart(summarySource, parsers, { logger, now }) {
	const summaryTable = summarySource.matches?.(SELECTORS.SUMMARY_CART_TABLE)
		? summarySource
		: summarySource.querySelector?.(SELECTORS.SUMMARY_CART_TABLE);

	if (!summaryTable) {
		logger?.("Enrollment summary cart table not found yet");
		return [];
	}

	logger?.("Found enrollment summary cart table");
	const termInfo = getSummaryTermInfo(summaryTable);
	const rows = summaryTable.querySelectorAll(
		`${SELECTORS.SUMMARY_PRIMARY_ROW}, ${SELECTORS.SUMMARY_DETAIL_ROW}`,
	);
	logger?.("Found", rows.length, "summary cart rows");

	const courses = [];
	let currentCourse = null;
	let currentSummaryComponent = null;

	const pushCurrentCourse = () => {
		if (!currentCourse) return;
		const course =
			currentCourse.components.length === 0 && currentSummaryComponent
				? {
						...currentCourse,
						components: [currentSummaryComponent],
					}
				: currentCourse;
		courses.push(course);
	};

	for (const row of rows) {
		if (row.matches(SELECTORS.SUMMARY_PRIMARY_ROW)) {
			pushCurrentCourse();

			const parsed = createCourseFromSummaryRow(
				row,
				parsers,
				termInfo,
				now,
				logger,
			);
			if (!parsed) {
				currentCourse = null;
				currentSummaryComponent = null;
				continue;
			}

			currentCourse = parsed.course;
			currentSummaryComponent = parsed.summaryComponent;
			logger?.(
				`Parsed summary course: ${currentCourse.courseCode}-${currentCourse.section} (${currentCourse.credits} credits)`,
			);
			continue;
		}

		if (!currentCourse || !row.matches(SELECTORS.SUMMARY_DETAIL_ROW)) {
			continue;
		}

		const component = parseSummaryComponent(row, currentCourse.section, parsers);
		currentCourse = {
			...currentCourse,
			components: [...currentCourse.components, component],
		};
		logger?.(`Added summary ${component.type} to ${currentCourse.courseCode}`);
	}

	pushCurrentCourse();
	return courses;
}

function parseAlbertCart(cartTable, parsers, options) {
	if (
		cartTable?.matches(SELECTORS.SUMMARY_CART_TABLE) ||
		cartTable?.matches(SELECTORS.SUMMARY_TERM_WRAPPER)
	) {
		return {
			courses: parseSummaryCart(cartTable, parsers, options),
			term: getSummaryTermInfo(cartTable),
		};
	}

	const courses = parseShoppingCart(cartTable, parsers, options);
	return {
		courses,
		term: courses[0]?.term || getPageTermInfo(cartTable),
	};
}

function parseEnrolledCourseCell(cell, logger) {
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
		logger?.(`Could not parse enrolled course cell: "${text}"`);
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

function parseEnrolledCourses(enrolledTable, parsers, { logger, now }) {
	const termInfo = getPageTermInfo(enrolledTable);
	const rows = enrolledTable.querySelectorAll("tr.accordion-row");
	logger?.("Found", rows.length, "enrolled course rows");

	const courses = [];
	let currentCourse = null;

	for (const row of rows) {
		const courseCell = row.querySelector('td[headers^="tbl_Course"]');
		const info = courseCell ? parseEnrolledCourseCell(courseCell, logger) : null;
		if (!info) continue;

		const sameCourse =
			currentCourse &&
			(info.crseId
				? info.crseId === currentCourse.crseId
				: info.courseCode === currentCourse.courseCode);

		if (sameCourse) {
			const component = parseEnrolledComponent(
				row,
				info.section,
				"Recitation",
				parsers,
			);
			currentCourse = {
				...currentCourse,
				components: [...currentCourse.components, component],
			};
			logger?.(
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
			addedAt: now(),
			...(termInfo ? { term: termInfo } : {}),
		};
		logger?.(
			`Parsed enrolled course: ${info.courseCode}-${info.section} (${info.credits} credits)`,
		);
	}

	if (currentCourse) courses.push(currentCourse);

	return {
		courses: courses.map(({ crseId, ...course }) => course),
		term: termInfo,
	};
}

export function parseAlbertPage({
	cartTable = null,
	enrolledTable = null,
	parsers,
	logger = null,
	now = Date.now,
}) {
	const options = { logger, now };
	const cartResult = cartTable
		? parseAlbertCart(cartTable, parsers, options)
		: { courses: [], term: null };
	const enrolledResult = enrolledTable
		? parseEnrolledCourses(enrolledTable, parsers, options)
		: { courses: [], term: null };

	return {
		courses: [...cartResult.courses, ...enrolledResult.courses],
		term: cartResult.term || enrolledResult.term,
	};
}
