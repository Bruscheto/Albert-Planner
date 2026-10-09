import { courseMetadataEffects } from "./course-metadata-effects.js";
import { formatTime } from "../shared/time-parser.js";

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

function formatTimeDisplay(time) {
	if (!time) return "--:--";
	const { hours, minutes } = time;
	const period = hours >= 12 ? "PM" : "AM";
	const h12 = hours % 12 || 12;
	return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// NYU class meetings overwhelmingly start on the hour or half hour between
// 8 AM and 9:30 PM, so offer every :00 and :30 in that range.
const QUICK_TIMES = [];
for (let hours = 8; hours <= 21; hours += 1) {
	QUICK_TIMES.push({ hours, minutes: 0 });
	QUICK_TIMES.push({ hours, minutes: 30 });
}

function formatQuickTime(time) {
	const h12 = time.hours % 12 || 12;
	const mm = String(time.minutes).padStart(2, "0");
	return `${h12}:${mm}`;
}

function formatQuickPeriod(time) {
	return time.hours >= 12 ? "PM" : "AM";
}

function createClockSvg() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.classList.add("metadata-time-icon");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "1.8");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	circle.setAttribute("cx", "12");
	circle.setAttribute("cy", "12");
	circle.setAttribute("r", "9");
	const hands = document.createElementNS("http://www.w3.org/2000/svg", "path");
	hands.setAttribute("d", "M12 7v5l3 2");
	svg.append(circle, hands);
	return svg;
}

function createChevronSvg() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.classList.add("metadata-time-chevron");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("stroke-linecap", "round");
	path.setAttribute("stroke-linejoin", "round");
	path.setAttribute("stroke-width", "2");
	path.setAttribute("d", "M6 9l6 6 6-6");
	svg.appendChild(path);
	return svg;
}

function createTimePicker({ initialTime, ariaLabel, onChange }) {
	const picker = document.createElement("div");
	picker.className = "metadata-time-picker";

	let currentTime = initialTime || null;
	let listWasOpened = false;

	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.className = "metadata-time-trigger";
	trigger.setAttribute("aria-haspopup", "listbox");
	trigger.setAttribute("aria-expanded", "false");
	trigger.setAttribute("aria-label", ariaLabel);

	const timeText = document.createElement("span");
	timeText.className = "metadata-time-text";
	timeText.textContent = formatTimeDisplay(currentTime);
	if (!currentTime) timeText.classList.add("is-empty");

	trigger.append(createClockSvg(), timeText, createChevronSvg());

	// Dropdown
	const dropdown = document.createElement("div");
	dropdown.className = "metadata-time-dropdown";
	dropdown.hidden = true;

	// Typed input row
	const typedRow = document.createElement("div");
	typedRow.className = "metadata-time-typed";

	const hourInput = document.createElement("input");
	hourInput.type = "text";
	hourInput.inputMode = "numeric";
	hourInput.autocomplete = "off";
	hourInput.spellcheck = false;
	hourInput.className = "metadata-time-input";
	hourInput.placeholder = "HH";
	hourInput.maxLength = 2;
	hourInput.setAttribute("aria-label", `${ariaLabel} hour`);

	const colon = document.createElement("span");
	colon.className = "metadata-time-colon";
	colon.textContent = ":";

	const minuteInput = document.createElement("input");
	minuteInput.type = "text";
	minuteInput.inputMode = "numeric";
	minuteInput.autocomplete = "off";
	minuteInput.spellcheck = false;
	minuteInput.className = "metadata-time-input";
	minuteInput.placeholder = "MM";
	minuteInput.maxLength = 2;
	minuteInput.setAttribute("aria-label", `${ariaLabel} minute`);

	const periodToggle = document.createElement("div");
	periodToggle.className = "metadata-time-period";
	periodToggle.setAttribute("role", "group");
	periodToggle.setAttribute("aria-label", "AM or PM");
	const amBtn = document.createElement("button");
	amBtn.type = "button";
	amBtn.className = "metadata-time-period-btn";
	amBtn.textContent = "AM";
	amBtn.dataset.period = "AM";
	amBtn.setAttribute("aria-pressed", "false");
	const pmBtn = document.createElement("button");
	pmBtn.type = "button";
	pmBtn.className = "metadata-time-period-btn";
	pmBtn.textContent = "PM";
	pmBtn.dataset.period = "PM";
	pmBtn.setAttribute("aria-pressed", "false");
	periodToggle.append(amBtn, pmBtn);

	typedRow.append(hourInput, colon, minuteInput, periodToggle);

	// Scrollable time list
	const list = document.createElement("div");
	list.className = "metadata-time-list";
	list.setAttribute("role", "listbox");
	list.setAttribute("aria-label", `Common ${ariaLabel.toLowerCase()} times`);

	const listButtons = [];
	for (const t of QUICK_TIMES) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "metadata-time-option";
		btn.setAttribute("role", "option");
		btn.setAttribute("aria-selected", "false");
		btn.dataset.hours = String(t.hours);
		btn.dataset.minutes = String(t.minutes);

		const value = document.createElement("span");
		value.className = "metadata-time-option-value";
		value.textContent = formatQuickTime(t);
		const period = document.createElement("span");
		period.className = "metadata-time-option-period";
		period.textContent = formatQuickPeriod(t);

		btn.append(value, period);
		list.appendChild(btn);
		listButtons.push(btn);
	}

	dropdown.append(typedRow, list);
	picker.append(trigger);

	// Dropdown lives on <body> (appended below) so it escapes overflow-clipping
	// (editor, cards, drawer body) and transform-containing ancestors (the
	// centered drawer uses translate(-50%,-50%), which captures fixed
	// positioning). Positioned via viewport rect in placeDropdown().
	dropdown.hidden = true;
	document.body.appendChild(dropdown);

	// State management
	const getValue = () => currentTime;

	const setValue = (time) => {
		currentTime = time;
		timeText.textContent = formatTimeDisplay(time);
		timeText.classList.toggle("is-empty", !time);
		syncInputs();
		updateListSelection();
		onChange?.(time);
	};

	const setPeriodActive = (period) => {
		const isAM = period === "AM";
		const isPM = period === "PM";
		amBtn.classList.toggle("is-active", isAM);
		pmBtn.classList.toggle("is-active", isPM);
		amBtn.setAttribute("aria-pressed", String(isAM));
		pmBtn.setAttribute("aria-pressed", String(isPM));
	};

	function syncInputs() {
		if (currentTime) {
			hourInput.value = String(currentTime.hours % 12 || 12);
			minuteInput.value = String(currentTime.minutes).padStart(2, "0");
			setPeriodActive(currentTime.hours >= 12 ? "PM" : "AM");
		} else {
			hourInput.value = "";
			minuteInput.value = "";
			setPeriodActive(null);
		}
	}

	function updateListSelection() {
		for (const btn of listButtons) {
			const h = Number(btn.dataset.hours);
			const m = Number(btn.dataset.minutes);
			const isSelected = Boolean(
				currentTime && currentTime.hours === h && currentTime.minutes === m,
			);
			btn.classList.toggle("is-selected", isSelected);
			btn.setAttribute("aria-selected", String(isSelected));
		}
	}

	function parseAndSet({ sync = true } = {}) {
		const h = parseInt(hourInput.value, 10);
		const m = parseInt(minuteInput.value, 10) || 0;
		const isPM = pmBtn.classList.contains("is-active");
		const isAM = amBtn.classList.contains("is-active");

		if (h >= 1 && h <= 12 && m >= 0 && m <= 59 && (isPM || isAM)) {
			const hours = isPM ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
			const time = { hours, minutes: m };
			if (sync) {
				setValue(time);
			} else {
				currentTime = time;
				timeText.textContent = formatTimeDisplay(time);
				timeText.classList.remove("is-empty");
				updateListSelection();
				onChange?.(time);
			}
		}
	}

	function clampField(input, max) {
		if (input.value.length > 2) input.value = input.value.slice(0, 2);
		const n = parseInt(input.value, 10);
		if (n > max) input.value = String(max);
	}

	function scrollSelectedIntoView() {
		const selected = list.querySelector(".metadata-time-option.is-selected");
		if (selected) {
			list.scrollTop = Math.max(
				0,
				selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2,
			);
			return;
		}
		// No exact match: position near the first option at or after the current time
		if (currentTime) {
			const current = currentTime.hours * 60 + currentTime.minutes;
			const next = listButtons.find((btn) => {
				const t = Number(btn.dataset.hours) * 60 + Number(btn.dataset.minutes);
				return t >= current;
			});
			if (next) {
				list.scrollTop = Math.max(
					0,
					next.offsetTop - list.clientHeight / 2 + next.clientHeight / 2,
				);
				return;
			}
		}
		list.scrollTop = 0;
	}

	// Dropdown toggle
	let closeTransitionTimer = 0;

	const closeDropdown = () => {
		picker.classList.remove("is-open");
		dropdown.classList.remove("is-open");
		trigger.setAttribute("aria-expanded", "false");
		listWasOpened = false;
		clearTimeout(closeTransitionTimer);
		closeTransitionTimer = setTimeout(() => {
			dropdown.hidden = true;
		}, 220);
		document.removeEventListener("click", onOutsideClick, true);
		document.removeEventListener("keydown", onEscape, true);
	};

	function onOutsideClick(e) {
		// The dropdown is on <body>, so check it as well as the trigger.
		if (!picker.contains(e.target) && !dropdown.contains(e.target)) {
			closeDropdown();
		}
	}

	function onEscape(e) {
		if (e.key === "Escape") {
			e.stopPropagation();
			closeDropdown();
			trigger.focus();
		}
	}

	// Viewport-aware placement on <body>: fixed positioning + viewport
	// coordinates from the trigger rect. No ancestor clipping or transforms.
	const placeDropdown = () => {
		const rect = trigger.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;
		const margin = 8;
		const gap = 6;

		const spaceBelow = viewportH - rect.bottom - margin;
		const spaceAbove = rect.top - margin;
		const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;

		const typedRowH = typedRow.offsetHeight || 56;
		const chrome = 28; // dropdown padding + list top margin
		const available = Math.max(120, (openUp ? spaceAbove : spaceBelow) - gap);
		const listMax = Math.max(
			64,
			Math.min(176, available - typedRowH - chrome),
		);
		list.style.maxHeight = `${Math.floor(listMax)}px`;

		const menuHeight = Math.min(
			available,
			typedRowH + chrome + Math.min(list.scrollHeight, listMax),
		);

		const width = rect.width;
		let left = rect.left;
		left = Math.min(
			Math.max(margin, left),
			Math.max(margin, viewportW - margin - width),
		);
		const top = openUp ? rect.top - gap - menuHeight : rect.bottom + gap;

		dropdown.style.width = `${Math.floor(width)}px`;
		dropdown.style.left = `${Math.floor(left)}px`;
		dropdown.style.top = `${Math.floor(top)}px`;
		dropdown.classList.toggle("opens-up", openUp);
	};

	const openDropdown = () => {
		clearTimeout(closeTransitionTimer);
		dropdown.hidden = false;
		picker.classList.add("is-open");
		dropdown.classList.add("is-open");
		trigger.setAttribute("aria-expanded", "true");
		syncInputs();
		updateListSelection();
		placeDropdown();
		if (!listWasOpened) {
			listWasOpened = true;
			requestAnimationFrame(scrollSelectedIntoView);
		}
		requestAnimationFrame(() => hourInput.focus({ preventScroll: true }));
		document.addEventListener("click", onOutsideClick, true);
		document.addEventListener("keydown", onEscape, true);
	};

	trigger.addEventListener("click", (e) => {
		e.stopPropagation();
		if (picker.classList.contains("is-open")) {
			closeDropdown();
		} else {
			openDropdown();
		}
	});

	// Time list selection
	list.addEventListener("click", (e) => {
		const btn = e.target.closest(".metadata-time-option");
		if (!btn) return;
		const hours = Number(btn.dataset.hours);
		const minutes = Number(btn.dataset.minutes);
		setValue({ hours, minutes });
		closeDropdown();
		trigger.focus();
	});

	// Typed input handlers
	hourInput.addEventListener("input", () => {
		clampField(hourInput, 12);
		if (
			hourInput.value &&
			!amBtn.classList.contains("is-active") &&
			!pmBtn.classList.contains("is-active")
		) {
			// Auto-detect AM/PM based on typical class times
			const h = parseInt(hourInput.value, 10);
			const h24 = h >= 8 && h <= 11 ? h : h === 12 ? 12 : h + 12;
			setPeriodActive(h24 >= 12 ? "PM" : "AM");
		}
		parseAndSet({ sync: false });
	});

	minuteInput.addEventListener("input", () => {
		clampField(minuteInput, 59);
		parseAndSet({ sync: false });
	});

	hourInput.addEventListener("blur", () => {
		if (hourInput.value) parseAndSet();
	});

	minuteInput.addEventListener("blur", () => {
		if (minuteInput.value.length === 1) {
			minuteInput.value = minuteInput.value.padStart(2, "0");
		}
		if (minuteInput.value) parseAndSet();
	});

	hourInput.addEventListener("keydown", (e) => {
		if (e.key === "ArrowUp" || e.key === "ArrowDown") {
			e.preventDefault();
			const delta = e.key === "ArrowUp" ? 1 : -1;
			let h = parseInt(hourInput.value, 10) || 12;
			h = ((((h - 1 + delta) % 12) + 12) % 12) + 1;
			hourInput.value = String(h);
			if (
				!amBtn.classList.contains("is-active") &&
				!pmBtn.classList.contains("is-active")
			) {
				setPeriodActive(h >= 8 && h <= 11 ? "AM" : "PM");
			}
			parseAndSet();
		}
	});

	minuteInput.addEventListener("keydown", (e) => {
		if (e.key === "ArrowUp" || e.key === "ArrowDown") {
			e.preventDefault();
			const delta = e.key === "ArrowUp" ? 5 : -5;
			let m = parseInt(minuteInput.value, 10) || 0;
			m = (((m + delta) % 60) + 60) % 60;
			minuteInput.value = String(m).padStart(2, "0");
			parseAndSet();
		}
	});

	amBtn.addEventListener("click", () => {
		setPeriodActive("AM");
		parseAndSet();
	});

	pmBtn.addEventListener("click", () => {
		setPeriodActive("PM");
		parseAndSet();
	});

	// Initialize
	syncInputs();

	return { element: picker, getValue, setValue };
}

function createScheduleEditor(course, component, onScheduleSave) {
	const item = document.createElement("div");
	item.className = "metadata-schedule-item";

	// ── Display row ──
	const row = document.createElement("div");
	row.className = "metadata-schedule-row";

	const typeBadge = document.createElement("span");
	typeBadge.className = "metadata-schedule-type";
	typeBadge.textContent = (component.type || "Meeting").slice(0, 3).toUpperCase();

	const details = document.createElement("div");
	details.className = "metadata-schedule-details";

	const time = document.createElement("span");
	time.className = "metadata-meta-line";
	time.textContent = formatMetaLine(component);

	const room = document.createElement("span");
	room.className = "metadata-location-line";
	room.textContent = formatLocation(component) || "Location TBA";

	details.append(time, room);

	const editBtn = document.createElement("button");
	editBtn.type = "button";
	editBtn.className = "metadata-schedule-edit-btn";
	editBtn.setAttribute("aria-label", `Edit ${component.type || "meeting"} schedule`);
	editBtn.setAttribute("aria-expanded", "false");
	editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

	row.append(typeBadge, details, editBtn);

	// ── Inline editor ──
	const editor = document.createElement("div");
	editor.className = "metadata-schedule-editor";

	const editorInner = document.createElement("div");
	editorInner.className = "metadata-schedule-editor-inner";

	const form = document.createElement("form");
	form.className = "metadata-schedule-form";

	// Days selector
	const daysField = document.createElement("div");
	daysField.className = "metadata-editor-field";
	const daysLabel = document.createElement("span");
	daysLabel.className = "metadata-editor-label";
	daysLabel.textContent = "Days";
	const daysRow = document.createElement("div");
	daysRow.className = "metadata-editor-days";
	for (const { day, short } of [
		{ day: "Mon", short: "M" },
		{ day: "Tue", short: "T" },
		{ day: "Wed", short: "W" },
		{ day: "Thu", short: "T" },
		{ day: "Fri", short: "F" },
	]) {
		const label = document.createElement("label");
		label.className = "metadata-day-chip";
		const input = document.createElement("input");
		input.type = "checkbox";
		input.name = "days";
		input.value = day;
		input.checked = component.days?.includes(day) ?? false;
		input.setAttribute("aria-label", day);
		const text = document.createElement("span");
		text.textContent = short;
		label.append(input, text);
		daysRow.appendChild(label);
	}
	daysField.append(daysLabel, daysRow);

	// Time inputs
	const timeField = document.createElement("div");
	timeField.className = "metadata-editor-field";
	const timeLabel = document.createElement("span");
	timeLabel.className = "metadata-editor-label";
	timeLabel.textContent = "Time";
	const timeRow = document.createElement("div");
	timeRow.className = "metadata-editor-time-row";

	const startPicker = createTimePicker({
		initialTime: component.timeRange?.start,
		ariaLabel: "Start time",
	});

	const timeSep = document.createElement("span");
	timeSep.className = "metadata-editor-time-sep";
	timeSep.textContent = "–";

	const endPicker = createTimePicker({
		initialTime: component.timeRange?.end,
		ariaLabel: "End time",
	});

	timeRow.append(startPicker.element, timeSep, endPicker.element);
	timeField.append(timeLabel, timeRow);

	// Location input
	const locationField = document.createElement("div");
	locationField.className = "metadata-editor-field";
	const locationLabel = document.createElement("span");
	locationLabel.className = "metadata-editor-label";
	locationLabel.textContent = "Location";
	const location = document.createElement("input");
	location.type = "text";
	location.name = "location";
	location.className = "metadata-editor-input metadata-editor-input--full";
	location.value = component.room || "";
	location.placeholder = "WWH 101 or Online";
	location.maxLength = 120;
	locationField.append(locationLabel, location);

	// Actions
	const actions = document.createElement("div");
	actions.className = "metadata-editor-actions";

	const status = document.createElement("span");
	status.className = "metadata-editor-status";
	status.setAttribute("role", "status");

	const cancel = document.createElement("button");
	cancel.type = "button";
	cancel.className = "metadata-editor-btn metadata-editor-btn--ghost";
	cancel.textContent = "Cancel";

	const save = document.createElement("button");
	save.type = "submit";
	save.className = "metadata-editor-btn metadata-editor-btn--primary";
	save.textContent = "Save";

	const buttons = document.createElement("div");
	buttons.className = "metadata-editor-buttons";
	buttons.append(cancel, save);

	actions.append(status, buttons);
	form.append(daysField, timeField, locationField, actions);
	editorInner.appendChild(form);
	editor.appendChild(editorInner);
	item.append(row, editor);

	// ── Toggle editor ──
	const closeEditor = () => {
		item.classList.remove("is-editing");
		editBtn.setAttribute("aria-expanded", "false");
		// Reset to initial values
		startPicker.setValue(component.timeRange?.start || null);
		endPicker.setValue(component.timeRange?.end || null);
		location.value = component.room || "";
		for (const input of daysRow.querySelectorAll("input")) {
			input.checked = component.days?.includes(input.value) ?? false;
		}
		status.textContent = "";
		status.classList.remove("is-error");
		save.disabled = false;
	};

	editBtn.addEventListener("click", () => {
		const isEditing = item.classList.toggle("is-editing");
		editBtn.setAttribute("aria-expanded", String(isEditing));
		if (isEditing) {
			requestAnimationFrame(() => {
				const firstDay = daysRow.querySelector("input");
				if (firstDay) firstDay.focus({ preventScroll: true });
			});
		}
	});

	cancel.addEventListener("click", closeEditor);

	// ── Save handler ──
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		status.classList.remove("is-error");
		const startTime = startPicker.getValue();
		const endTime = endPicker.getValue();
		const selectedDays = Array.from(
			form.querySelectorAll('input[name="days"]:checked'),
		).map((input) => input.value);

		const hasStart = Boolean(startTime);
		const hasEnd = Boolean(endTime);

		if (hasStart !== hasEnd) {
			status.textContent = "Enter both times";
			status.classList.add("is-error");
			return;
		}
		if (hasStart && selectedDays.length === 0) {
			status.textContent = "Select at least one day";
			status.classList.add("is-error");
			return;
		}
		if (
			startTime &&
			endTime &&
			startTime.hours * 60 + startTime.minutes >=
				endTime.hours * 60 + endTime.minutes
		) {
			status.textContent = "End must be after start";
			status.classList.add("is-error");
			return;
		}

		save.disabled = true;
		save.textContent = "Saving…";
		try {
			await onScheduleSave(course.components.indexOf(component), {
				days: selectedDays,
				timeRange: startTime ? { start: startTime, end: endTime } : null,
				room: location.value,
			});
			closeEditor();
			time.textContent = formatMetaLine({
				...component,
				days: selectedDays,
				timeRange: startTime ? { start: startTime, end: endTime } : null,
			});
			room.textContent = location.value || "Location TBA";
		} catch (error) {
			console.error("[Albert Enhancer] Schedule update failed:", error);
			status.textContent = "Could not save";
			status.classList.add("is-error");
			save.disabled = false;
		} finally {
			save.textContent = "Save";
		}
	});

	return item;
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
			text: `Scheduled · ${scheduledDays.join("/")}`,
			cls: "status-scheduled",
		});
	} else if (!isPlanned) {
		tags.push({ text: "Not scheduled", cls: "status-neutral" });
	}

	if (online) {
		tags.push({ text: "Online", cls: "status-online" });
	}

	if (isPlanned && conflictCodes.length > 0) {
		tags.push({
			text: `Conflicts: ${conflictCodes.join(", ")}`,
			cls: "status-conflict",
		});
	}

	for (const type of missingTypes) {
		tags.push({ text: `${type} TBA`, cls: "status-warn" });
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
	button.setAttribute("role", "option");
	button.setAttribute("aria-selected", String(isActive));
	if (isActive) {
		button.classList.add("is-active");
	}

	const dot = document.createElement("span");
	dot.className = "metadata-bucket-dot";
	if (bucket.color) {
		dot.style.backgroundColor = bucket.color;
	}

	const name = document.createElement("span");
	name.className = "metadata-bucket-name";
	name.textContent = bucket.name;

	button.append(dot, name);

	if (isActive) {
		const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		check.classList.add("metadata-bucket-check");
		check.setAttribute("viewBox", "0 0 24 24");
		check.setAttribute("fill", "none");
		check.setAttribute("stroke", "currentColor");
		check.setAttribute("aria-hidden", "true");
		const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
		checkPath.setAttribute("stroke-linecap", "round");
		checkPath.setAttribute("stroke-linejoin", "round");
		checkPath.setAttribute("stroke-width", "2.5");
		checkPath.setAttribute("d", "M5 13l4 4L19 7");
		check.appendChild(checkPath);
		button.appendChild(check);
	}

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
				const result = await courseMetadataEffects.lookupRmpProfessor(
					professorName,
					course,
				);
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
		const { rating } = await courseMetadataEffects.saveManualProfessorRating(
			profName,
			raw,
		);
		if (rating === null) {
			badge.classList.remove("has-value");
			badge.textContent = "~";
			badge.title = "Add rating";
		} else {
			badge.classList.add("has-value", `rating-${ratingTier(rating)}`);
			badge.replaceChildren(...makeDotNumber(rating.toFixed(1)));
			badge.title = `Rating: ${rating}/5 — click to edit`;
		}
		badge.style.width = "";
		badge.style.height = "";
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
	onScheduleSave,
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

	const displayComponent = focusComponent || getPrimaryComponent(course);
	const section = displayComponent?.section ?? course.section;
	const sectionMarkup = section
		? ` <span class="metadata-course-section">· ${section}</span>`
		: "";

	// ── Header card: identity + status ──
	const header = document.createElement("div");
	header.className = "metadata-card metadata-header";

	const headline = document.createElement("div");
	headline.className = "metadata-headline";
	headline.innerHTML = `
		<h2 class="metadata-course-code">${course.courseCode}${sectionMarkup}</h2>
		<span class="metadata-credit-pill">${course.credits ?? "-"} cr</span>
	`;

	const title = document.createElement("p");
	title.className = "metadata-course-title";
	title.textContent = course.title || "Untitled Course";

	header.append(headline, title);

	const statusTags = buildStatusTags(context);
	if (statusTags) {
		header.appendChild(statusTags);
	}

	// ── Instructors card ──
	const instructors = getInstructors(course);
	let instructorCard = null;
	if (instructors.length > 0) {
		instructorCard = document.createElement("div");
		instructorCard.className = "metadata-card";

		const cardLabel = document.createElement("span");
		cardLabel.className = "metadata-card-label";
		cardLabel.textContent = instructors.length > 1 ? "Instructors" : "Instructor";

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

		instructorCard.append(cardLabel, instructorLine);
	}

	// ── Schedule card ──
	const scheduleCard = document.createElement("div");
	scheduleCard.className = "metadata-card";

	const scheduleLabel = document.createElement("span");
	scheduleLabel.className = "metadata-card-label";
	scheduleLabel.textContent = "Schedule";

	if (course.components.length) {
		const schedules = document.createElement("div");
		schedules.className = "metadata-schedule-list";
		for (let i = 0; i < course.components.length; i++) {
			const component = course.components[i];
			schedules.appendChild(
				createScheduleEditor(course, component, onScheduleSave),
			);
		}
		scheduleCard.append(scheduleLabel, schedules);
	} else {
		const meta = document.createElement("p");
		meta.className = "metadata-meta-line metadata-schedule-empty";
		meta.textContent = formatMetaLine(displayComponent);
		scheduleCard.append(scheduleLabel, meta);
	}

	// ── Bucket card: current selection + dropdown picker ──
	const allBuckets = [
		{ id: null, name: "Unsorted", color: "#9ca3af" },
		...buckets,
	];
	const activeBucket = allBuckets.find((b) => (b.id ?? null) === (course.bucket ?? null)) || allBuckets[0];

	const bucketCard = document.createElement("div");
	bucketCard.className = "metadata-card metadata-bucket-card";

	const bucketLabel = document.createElement("span");
	bucketLabel.className = "metadata-card-label";
	bucketLabel.textContent = "Bucket";

	const picker = document.createElement("div");
	picker.className = "metadata-bucket-picker";

	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.className = "metadata-bucket-trigger";
	trigger.setAttribute("aria-haspopup", "listbox");
	trigger.setAttribute("aria-expanded", "false");

	const triggerDot = document.createElement("span");
	triggerDot.className = "metadata-bucket-dot";
	if (activeBucket.color) {
		triggerDot.style.backgroundColor = activeBucket.color;
	}

	const triggerName = document.createElement("span");
	triggerName.className = "metadata-bucket-trigger-name";
	triggerName.textContent = activeBucket.name;

	const triggerChevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	triggerChevron.classList.add("metadata-bucket-trigger-chevron");
	triggerChevron.setAttribute("viewBox", "0 0 24 24");
	triggerChevron.setAttribute("fill", "none");
	triggerChevron.setAttribute("stroke", "currentColor");
	triggerChevron.setAttribute("aria-hidden", "true");
	const chevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	chevronPath.setAttribute("stroke-linecap", "round");
	chevronPath.setAttribute("stroke-linejoin", "round");
	chevronPath.setAttribute("stroke-width", "2");
	chevronPath.setAttribute("d", "M6 9l6 6 6-6");
	triggerChevron.appendChild(chevronPath);

	trigger.append(triggerDot, triggerName, triggerChevron);

	const menu = document.createElement("div");
	menu.className = "metadata-bucket-menu";
	menu.setAttribute("role", "listbox");
	menu.setAttribute("aria-label", "Select bucket");

	const closeMenu = () => {
		picker.classList.remove("is-open");
		trigger.setAttribute("aria-expanded", "false");
		document.removeEventListener("click", onOutsideClick, true);
		document.removeEventListener("keydown", onEscape, true);
	};

	const onOutsideClick = (event) => {
		if (!picker.contains(event.target)) {
			closeMenu();
		}
	};

	const onEscape = (event) => {
		if (event.key === "Escape") {
			closeMenu();
			trigger.focus();
		}
	};

	trigger.addEventListener("click", (event) => {
		event.stopPropagation();
		const willOpen = !picker.classList.contains("is-open");
		if (willOpen) {
			picker.classList.add("is-open");
			trigger.setAttribute("aria-expanded", "true");
			document.addEventListener("click", onOutsideClick, true);
			document.addEventListener("keydown", onEscape, true);
		} else {
			closeMenu();
		}
	});

	for (const bucket of allBuckets) {
		menu.appendChild(
			createBucketOption(bucket, (bucket.id ?? null) === (course.bucket ?? null), (bucketId) => {
				closeMenu();
				if ((bucketId ?? null) !== (course.bucket ?? null)) {
					onBucketSelect(bucketId);
				}
			}),
		);
	}

	picker.append(trigger, menu);
	bucketCard.append(bucketLabel, picker);

	// ── Assemble ──
	const cards = [header];
	if (instructorCard) cards.push(instructorCard);
	cards.push(scheduleCard, bucketCard);
	container.append(...cards);
}
