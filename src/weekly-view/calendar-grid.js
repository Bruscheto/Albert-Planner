// Static calendar scaffolding: time labels, hour lines, quarter ticks,
// time anchors, and the "now" indicator.

import { getCalendarGrid, getTimeColumn } from "./runtime.js";
import {
	START_HOUR,
	END_HOUR,
	HOUR_HEIGHT,
	DAYS,
	HEADER_OFFSET,
} from "./config.js";

export function generateTimeLabels() {
	const timeColumn = getTimeColumn();
	if (!timeColumn) return;
	timeColumn.innerHTML = "";

	const spacer = document.createElement("div");
	spacer.className = "time-header-spacer";
	timeColumn.appendChild(spacer);

	for (let hour = START_HOUR; hour < END_HOUR; hour++) {
		const label = document.createElement("div");
		label.className = "time-label";
		const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
		const suffix =
			hour === 12 ? "p" : hour > 12 ? "p" : hour === 0 ? "a" : "a";
		label.innerHTML = `<span class="time-label-num">${displayHour}</span><span class="time-label-meridiem">${suffix}</span>`;
		timeColumn.appendChild(label);
	}
}

export function generateHourLines() {
	const hours = END_HOUR - START_HOUR;
	document.documentElement.style.setProperty("--day-slot-hours", String(hours));
	for (const day of DAYS) {
		const slotsContainer = document.getElementById(`slots-${day}`);
		if (!slotsContainer) continue;
		slotsContainer.innerHTML = "";
		for (let offset = 1; offset <= hours; offset++) {
			const line = document.createElement("div");
			line.className = "hour-line";
			line.style.top = `${offset * HOUR_HEIGHT}px`;
			slotsContainer.appendChild(line);
		}
	}
}

export function generateQuarterTicks() {
	const hours = END_HOUR - START_HOUR;
	for (const day of DAYS) {
		const slotsContainer = document.getElementById(`slots-${day}`);
		if (!slotsContainer) continue;
		for (let offset = 0; offset < hours; offset++) {
			for (const q of [15, 30, 45]) {
				const tick = document.createElement("div");
				tick.className = "quarter-tick";
				if (q === 30) tick.classList.add("is-half");
				tick.style.top = `${offset * HOUR_HEIGHT + (q / 60) * HOUR_HEIGHT}px`;
				slotsContainer.appendChild(tick);
			}
		}
	}
}

export function renderTimeAnchors() {
	const grid = getCalendarGrid();
	if (!grid) return;
	for (const old of grid.querySelectorAll(".time-anchor")) old.remove();

	const anchors = [
		{ hour: 12, label: "NOON" },
		{ hour: 17, label: "EVE" },
	];
	for (const a of anchors) {
		if (a.hour < START_HOUR || a.hour >= END_HOUR) continue;
		const el = document.createElement("div");
		el.className = "time-anchor";
		el.textContent = a.label;
		const top = HEADER_OFFSET + ((a.hour - START_HOUR) * 60 / 60) * HOUR_HEIGHT;
		el.style.top = `${top}px`;
		el.setAttribute("aria-hidden", "true");
		grid.appendChild(el);
	}
}

export function mountNowIndicator() {
	const grid = getCalendarGrid();
	if (!grid) return;
	if (grid.querySelector(".now-indicator")) return;
	const wrap = document.createElement("div");
	wrap.className = "now-indicator";
	wrap.setAttribute("aria-hidden", "true");
	wrap.hidden = true;
	const dot = document.createElement("span");
	dot.className = "now-indicator-dot";
	wrap.appendChild(dot);
	const pill = document.createElement("span");
	pill.className = "now-indicator-pill";
	wrap.appendChild(pill);
	grid.appendChild(wrap);
}

export function updateNowIndicator() {
	const wrap = getCalendarGrid()?.querySelector(".now-indicator");
	if (!wrap) return;
	const now = new Date();
	const weekdayIndex = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	const todayCol = weekdayIndex - 1; // 0=Mon ... 4=Fri
	const hours = now.getHours();
	const minutes = now.getMinutes();
	const nowMinutes = hours * 60 + minutes;
	const startMinutes = START_HOUR * 60;
	const endMinutes = END_HOUR * 60;

	const inRange =
		todayCol >= 0 && todayCol <= 4 && nowMinutes >= startMinutes && nowMinutes <= endMinutes;
	if (!inRange) {
		wrap.hidden = true;
		return;
	}
	const top =
		HEADER_OFFSET + ((nowMinutes - startMinutes) / 60) * HOUR_HEIGHT;
	wrap.style.top = `${top}px`;
	wrap.style.setProperty("--today-col", String(todayCol));
	const pill = wrap.querySelector(".now-indicator-pill");
	if (pill) {
		const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
		const mm = String(minutes).padStart(2, "0");
		const meridiem = hours >= 12 ? "p" : "a";
		pill.textContent = `${h12}:${mm}${meridiem}`;
	}
	wrap.hidden = false;
}
