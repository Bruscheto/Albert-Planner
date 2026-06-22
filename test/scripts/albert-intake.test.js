import assert from "node:assert/strict";
import { parseAlbertPage } from "../../src/content/albert-intake.js";
import { parseDays, parseTimeRange } from "../../src/shared/time-parser.js";

class TestElement {
	constructor(tagName, attrs = {}, children = [], text = "") {
		this.tagName = tagName.toUpperCase();
		this.attrs = { ...attrs };
		this.children = children;
		this._text = text;
		this.parentElement = null;
		this.ownerDocument = null;
		this.previousElementSibling = null;
		for (let index = 0; index < children.length; index += 1) {
			const child = children[index];
			child.parentElement = this;
			child.previousElementSibling = children[index - 1] || null;
		}
	}

	get id() {
		return this.attrs.id || "";
	}

	get className() {
		return this.attrs.class || "";
	}

	get dataset() {
		const data = {};
		for (const [key, value] of Object.entries(this.attrs)) {
			if (!key.startsWith("data-")) continue;
			const name = key
				.slice(5)
				.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
			data[name] = value;
		}
		return data;
	}

	get textContent() {
		return `${this._text}${this.children.map((child) => child.textContent).join("")}`;
	}

	getAttribute(name) {
		return this.attrs[name] ?? null;
	}

	querySelector(selector) {
		return this.querySelectorAll(selector)[0] || null;
	}

	querySelectorAll(selector) {
		const selectors = selector.split(",").map((part) => part.trim());
		return descendants(this).filter((element) =>
			selectors.some((part) => element.matches(part)),
		);
	}

	matches(selector) {
		return matchesSelector(this, selector.trim());
	}

	closest(selector) {
		let current = this;
		while (current) {
			if (current.matches(selector)) return current;
			current = current.parentElement;
		}
		return null;
	}
}

function el(tagName, attrs = {}, children = [], text = "") {
	return new TestElement(tagName, attrs, children, text);
}

function textEl(tagName, text, attrs = {}) {
	return el(tagName, attrs, [], text);
}

function withDocument(root) {
	const document = { body: root };
	const assign = (node) => {
		node.ownerDocument = document;
		for (const child of node.children) assign(child);
	};
	assign(root);
	return root;
}

function descendants(root) {
	return root.children.flatMap((child) => [child, ...descendants(child)]);
}

function classes(element) {
	return new Set(element.className.split(/\s+/).filter(Boolean));
}

function matchesTagAndClasses(element, selector) {
	const [tagName, ...classNames] = selector.split(".");
	if (tagName && element.tagName.toLowerCase() !== tagName.toLowerCase()) {
		return false;
	}
	const elementClasses = classes(element);
	return classNames.every((className) => elementClasses.has(className));
}

function matchesAttributePrefix(element, selector) {
	const match = selector.match(/^\[([^\]^]+)\^="([^"]+)"\]$/);
	return match
		? String(element.getAttribute(match[1]) || "").startsWith(match[2])
		: false;
}

function matchesSelector(element, selector) {
	if (selector.includes(" ")) {
		const [ancestorSelector, childSelector] = selector.split(/\s+/, 2);
		return (
			matchesSelector(element, childSelector) &&
			Boolean(element.parentElement?.closest(ancestorSelector))
		);
	}
	if (selector === "td, th") {
		return element.tagName === "TD" || element.tagName === "TH";
	}
	if (selector === "td") return element.tagName === "TD";
	if (selector === "p") return element.tagName === "P";
	if (selector === "h1,h2,h3") {
		return ["H1", "H2", "H3"].includes(element.tagName);
	}
	if (selector.startsWith("[") && selector.includes("^=")) {
		return matchesAttributePrefix(element, selector);
	}
	const attrPrefixMatch = selector.match(/^([a-z]+)\[([^\]^]+)\^="([^"]+)"\]$/i);
	if (attrPrefixMatch) {
		return (
			element.tagName.toLowerCase() === attrPrefixMatch[1].toLowerCase() &&
			String(element.getAttribute(attrPrefixMatch[2]) || "").startsWith(
				attrPrefixMatch[3],
			)
		);
	}
	if (selector.startsWith(".")) {
		return classes(element).has(selector.slice(1));
	}
	if (selector.includes(".")) {
		return matchesTagAndClasses(element, selector);
	}
	return element.tagName.toLowerCase() === selector.toLowerCase();
}

function summaryRow(className, {
	course,
	day,
	time,
	location,
	instructor,
	title = "",
}) {
	return el("tr", { class: className }, [
		textEl("td", course, { "data-label": "Course", title }),
		textEl("td", instructor, { "data-label": "Instructor" }),
		textEl("td", location, { "data-label": "Location" }),
		textEl("td", time, { "data-label": "Time" }),
		textEl("td", day, { "data-label": "Day" }),
	]);
}

function cartRow({
	id,
	className,
	section,
	description,
	instructor,
	schedule,
	location,
	units,
	status,
}) {
	return el("tr", { class: "ps_grid-row" }, [
		el("div", { class: "ps_box-group psc_layout", id }, [
			textEl("span", "", {
				id: "P_CLASS_NAME$span0",
				title: className,
			}),
			textEl("span", section, { id: "CLASS_TBL_VW_CLASS_SECTION$0" }),
			textEl("span", description, { id: "CLASS_TBL_VW_DESCR$0" }),
			textEl("span", instructor, { id: "DERIVED_REGFRM1_SSR_INSTR_LONG$0" }),
			textEl("span", schedule, { id: "DERIVED_REGFRM1_SSR_MTG_SCHED_LONG$0" }),
			textEl("span", location, { id: "DERIVED_REGFRM1_SSR_MTG_LOC_LONG$0" }),
			textEl("span", units, { id: "SSR_REGFORM_VW_UNT_TAKEN$0" }),
			el("div", { id: "win0divDERIVED_REGFRM1_SSR_STATUS_LONG$0" }, [
				el("img", { alt: status }),
			]),
		]),
	]);
}

function enrolledRow({ crseId, course, section, day, time, location, instructor }) {
	return el("tr", { class: "accordion-row" }, [
		el("td", { headers: "tbl_Course" }, [
			el("div", { class: "isSSS_CourseTitle" }, [
				textEl("p", course, {
					"data-crseid": crseId,
					"data-classsection": section,
				}),
			]),
		]),
		textEl("td", instructor, { "data-label": "Instructor" }),
		textEl("td", location, { "data-label": "Location" }),
		textEl("td", time, { "data-label": "Time" }),
		textEl("td", day, { "data-label": "Day" }),
	]);
}

const parsers = { parseDays, parseTimeRange };
const fixedNow = () => 1_800_000_000_000;

{
	const summaryTable = withDocument(
		el("div", { class: "isSSS_ShCtTermWrp selected", id: "ShCtTm1268" }, [
			textEl("h2", "Fall 2026"),
			el("table", { class: "isSSS_ShCtTable accordion-table" }, [
				summaryRow("isSSS_ShCtPrim", {
					course: "Operating Systems CSCI-UA 202 002 (4)",
					title: "Operating Systems",
					instructor: "Ada Lovelace",
					location: "In-Person: WWH 109 Washington Sq",
					time: "09:30 AM - 10:45 AM",
					day: "MoWe",
				}),
				summaryRow("isSSS_ShCtNonPrim", {
					course: "Laboratory",
					instructor: "Grace Hopper",
					location: "CIWW 101 Brooklyn",
					time: "11:00 AM - 11:50 AM",
					day: "Fr",
				}),
			]),
		]),
	);

	const result = parseAlbertPage({
		cartTable: summaryTable,
		parsers,
		now: fixedNow,
	});

	assert.equal(result.term.name, "Fall 2026");
	assert.equal(result.term.termCode, "1268");
	assert.equal(result.courses.length, 1);
	assert.deepEqual(result.courses[0], {
		id: "CSCI-UA-202-002",
		courseCode: "CSCI-UA 202",
		section: "002",
		title: "Operating Systems",
		credits: 4,
		status: "In Cart",
		components: [
			{
				type: "Laboratory",
				section: "002",
				days: ["Fri"],
				timeRange: {
					start: { hours: 11, minutes: 0 },
					end: { hours: 11, minutes: 50 },
				},
				room: "CIWW 101",
				instructor: "Grace Hopper",
				isTBA: false,
				status: "In Cart",
			},
		],
		bucket: null,
		addedAt: fixedNow(),
		term: {
			name: "Fall 2026",
			semester: "Fall",
			year: 2026,
			termCode: "1268",
		},
	});
}

{
	const cartTable = withDocument(
		el("div", {}, [
			textEl("h2", "Spring 2027"),
			el("table", { class: "ps_grid-flex", title: "Shopping Cart" }, [
				cartRow({
					id: "win0divCART_GRID$0",
					className: "Class Code:CORE-UA 203-010 (15133)",
					section: "010",
					description: "Energy and the Environment",
					instructor: "Jane Goldberg",
					schedule: "TuTh 09:30 AM - 10:45 AM",
					location: "Silver 401",
					units: "4",
					status: "In Cart",
				}),
				cartRow({
					id: "win0divCART_GRID$1",
					className: "Class Code:CORE-UA 203-011 (15134)",
					section: "011",
					description: "Recitation",
					instructor: "John Assistant",
					schedule: "Fr 01:00 PM - 01:50 PM",
					location: "Silver 402",
					units: "",
					status: "In Cart",
				}),
			]),
		]).querySelector("table"),
	);

	const result = parseAlbertPage({
		cartTable,
		parsers,
		now: fixedNow,
	});

	assert.equal(result.term.name, "Spring 2027");
	assert.equal(result.courses.length, 1);
	assert.equal(result.courses[0].courseCode, "CORE-UA 203");
	assert.equal(result.courses[0].classNumber, "15133");
	assert.equal(result.courses[0].components.length, 2);
	assert.deepEqual(result.courses[0].components.map((component) => component.type), [
		"Lecture",
		"Recitation",
	]);
	assert.deepEqual(result.courses[0].components[0].days, ["Tue", "Thu"]);
	assert.deepEqual(result.courses[0].components[1].timeRange, {
		start: { hours: 13, minutes: 0 },
		end: { hours: 13, minutes: 50 },
	});
}

{
	const enrolledTable = withDocument(
		el("div", {}, [
			textEl("h2", "Fall 2026"),
			el("table", { id: "isSSS_ShCtSchTable" }, [
				enrolledRow({
					crseId: "123",
					course: "Operating Systems CSCI-UA 202 002 (4)",
					section: "002",
					instructor: "Ada Lovelace",
					location: "WWH 109",
					time: "02:00 PM - 03:15 PM",
					day: "MoWe",
				}),
				enrolledRow({
					crseId: "123",
					course: "Recitation CSCI-UA 202 003",
					section: "003",
					instructor: "Grace Hopper",
					location: "WWH 101",
					time: "04:00 PM - 04:50 PM",
					day: "Fr",
				}),
			]),
		]).querySelector("table"),
	);

	const result = parseAlbertPage({
		enrolledTable,
		parsers,
		now: fixedNow,
	});

	assert.equal(result.term.name, "Fall 2026");
	assert.equal(result.courses.length, 1);
	assert.equal(result.courses[0].status, "Enrolled");
	assert.equal(result.courses[0].crseId, undefined);
	assert.deepEqual(result.courses[0].components.map((component) => component.type), [
		"Lecture",
		"Recitation",
	]);
	assert.deepEqual(result.courses[0].components[1], {
		type: "Recitation",
		section: "003",
		days: ["Fri"],
		timeRange: {
			start: { hours: 16, minutes: 0 },
			end: { hours: 16, minutes: 50 },
		},
		room: "WWH 101",
		instructor: "Grace Hopper",
		isTBA: false,
		status: "Enrolled",
	});
}

console.log("Albert intake tests passed: summary, shopping cart, enrolled");
