// Bucket sidebar and planning-tray rendering.

import { state, dom } from "./context.js";
import { courseCodeToColor, isCourseOnline } from "./colors.js";
import {
	handlePlannerAdd,
	handlePlannerRemove,
	startBucketRename,
	handleBucketRecolor,
	toggleBucketDeleteSelection,
} from "./bucket-actions.js";
import { openCourseMetadataDrawer } from "./metadata-drawer.js";
import {
	handleBucketWrapperDragOver,
	handleBucketWrapperDragLeave,
	handleBucketWrapperDrop,
	handleBucketCourseDragStart,
	handleBucketCourseDragEnd,
} from "./drag-drop.js";

export function renderBucketsSidebar(byBucket, plannedSet = new Set()) {
	dom.sidebarBuckets.innerHTML = "";
	state.activeRenameState = null;

	const hasUserBuckets = Object.keys(byBucket).some(
		(key) => key !== "unsorted",
	);
	if (!hasUserBuckets) {
		const helper = document.createElement("p");
		helper.className = "bucket-helper-text";
		helper.textContent =
			"// organize courses into groups to compare schedule options";
		dom.sidebarBuckets.appendChild(helper);
	}

	for (const key of Object.keys(byBucket)) {
		const { bucket, courses } = byBucket[key];
		const bucketId = bucket.id ?? null;
		const collapseKey = bucketId ?? "unsorted";
		let isCollapsed = state.bucketCollapseState.get(collapseKey);
		if (isCollapsed === undefined) {
			isCollapsed = true;
			state.bucketCollapseState.set(collapseKey, true);
		}
		const isDeletable = Boolean(bucketId);
		const isSelectedForDelete =
			state.deleteMode && isDeletable && state.bucketsPendingDeletion.has(bucketId);

		const wrapper = document.createElement("div");
		wrapper.className = "bucket-wrapper";
		wrapper.dataset.bucketId = collapseKey;
		if (state.deleteMode && isDeletable) {
			wrapper.classList.add("is-delete-mode");
		}
		if (isSelectedForDelete) {
			wrapper.classList.add("is-selected-for-delete");
		}

		const header = document.createElement("div");
		header.className = "bucket-item";
		header.tabIndex = 0;
		header.setAttribute("role", "button");
		header.setAttribute(
			"aria-label",
			`${bucket.name} bucket, ${courses.length} courses`,
		);
		header.setAttribute("aria-expanded", String(!isCollapsed));
		if (state.deleteMode && isDeletable) {
			header.classList.add("is-delete-mode");
		}
		if (isSelectedForDelete) {
			header.classList.add("is-selected-for-delete");
		}
		header.dataset.bucketId = collapseKey;
		const actionButtons = bucketId
			? `
				<button type="button" class="bucket-action-button bucket-rename-button" title="Rename bucket" aria-label="Rename bucket">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 20h9"/>
						<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
					</svg>
				</button>
				<button type="button" class="bucket-action-button bucket-color-button" title="Change color" aria-label="Change bucket color">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
					</svg>
				</button>
			`
			: "";
		header.innerHTML = `
			${
				state.deleteMode && isDeletable
					? `<span class="bucket-delete-select ${
							isSelectedForDelete ? "is-selected" : ""
						}">${isSelectedForDelete ? "✓" : ""}</span>`
					: ""
			}
			<div class="bucket-main">
				<span class="bucket-dot" style="background: ${bucket.color}"></span>
				<span class="bucket-label${bucketId ? " bucket-label-editable" : ""}">
					${bucket.name}
				</span>
			</div>
			<div class="bucket-meta">
				<span class="bucket-count">${courses.length}</span>
				${actionButtons}
				<svg class="bucket-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M6 9l6 6 6-6" />
				</svg>
			</div>
		`;

		const courseList = document.createElement("div");
		courseList.className = "bucket-course-list";
		courseList.dataset.bucketId = collapseKey;

		const courseListInner = document.createElement("div");
		courseListInner.className = "bucket-course-list-inner";

		if (isCollapsed) {
			courseList.classList.add("is-collapsed");
			header.classList.add("is-collapsed");
			wrapper.classList.add("is-collapsed");
		}

		// Attach drag handlers to wrapper
		wrapper.addEventListener("dragover", handleBucketWrapperDragOver);
		wrapper.addEventListener("dragleave", handleBucketWrapperDragLeave);
		wrapper.addEventListener("drop", handleBucketWrapperDrop);

		if (courses.length === 0) {
			const empty = document.createElement("div");
			empty.className = "bucket-course-empty";
			empty.textContent = "// empty";
			courseListInner.appendChild(empty);
		} else {
			for (const course of courses) {
				const entry = document.createElement("div");
				entry.className = "bucket-course-entry";
				entry.dataset.courseId = course.id;
				entry.dataset.bucketId = bucketId ?? "";
				entry.style.setProperty(
					"--course-accent",
					courseCodeToColor(course.courseCode),
				);
				entry.setAttribute(
					"aria-label",
					`${course.courseCode} — ${course.title}`,
				);
				// The whole card is the drag target (not just the grip handle).
				entry.draggable = true;
				entry.addEventListener("dragstart", handleBucketCourseDragStart);
				entry.addEventListener("dragend", handleBucketCourseDragEnd);
				const isPlanned = plannedSet.has(course.id);
				if (isPlanned) {
					entry.classList.add("is-planned");
				}

				const body = document.createElement("div");
				body.className = "course-entry-body";
				const onlineTag = isCourseOnline(course)
					? ' <span class="course-online-tag" title="Online course">~online</span>'
					: "";
				body.innerHTML = `
					<strong>${course.courseCode}</strong>
					<span>${course.title}${onlineTag}</span>
				`;

				const footer = document.createElement("div");
				footer.className = "course-entry-footer";

				const toggleButton = document.createElement("button");
				toggleButton.type = "button";
				if (isPlanned) {
					toggleButton.className = "course-icon-btn course-icon-btn--remove";
					toggleButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
					toggleButton.ariaLabel = "Remove from calendar";
					toggleButton.title = "Remove from calendar";
					toggleButton.addEventListener("click", (event) => {
						event.stopPropagation();
						handlePlannerRemove(course.id);
					});
				} else {
					toggleButton.className = "course-icon-btn course-icon-btn--add";
					toggleButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
					toggleButton.ariaLabel = "Add to calendar";
					toggleButton.title = "Add to calendar";
					toggleButton.addEventListener("click", (event) => {
						event.stopPropagation();
						handlePlannerAdd(course.id);
					});
				}

				const editButton = document.createElement("button");
				editButton.type = "button";
				editButton.className = "course-icon-btn course-icon-btn--edit";
				editButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
				editButton.ariaLabel = "Edit course metadata";
				editButton.title = "Edit course metadata";
				editButton.addEventListener("click", (event) => {
					event.stopPropagation();
					openCourseMetadataDrawer(course.id);
				});

				footer.append(toggleButton, editButton);
				entry.append(body, footer);
				courseListInner.appendChild(entry);
			}
		}

		courseList.appendChild(courseListInner);

		const toggleBucketCollapse = () => {
			const nextCollapsed = !courseList.classList.contains("is-collapsed");
			courseList.classList.toggle("is-collapsed", nextCollapsed);
			header.classList.toggle("is-collapsed", nextCollapsed);
			wrapper.classList.toggle("is-collapsed", nextCollapsed);
			header.setAttribute("aria-expanded", String(!nextCollapsed));
			state.bucketCollapseState.set(collapseKey, nextCollapsed);
		};

		header.addEventListener("click", (event) => {
			if (event.target.closest(".bucket-action-button")) {
				return;
			}

			if (state.deleteMode && isDeletable) {
				toggleBucketDeleteSelection(bucketId, header);
				return;
			}

			toggleBucketCollapse();
		});

		header.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				if (state.deleteMode && isDeletable) {
					toggleBucketDeleteSelection(bucketId, header);
				} else {
					toggleBucketCollapse();
				}
			}
		});

		if (bucketId) {
			const label = header.querySelector(".bucket-label");
			label?.addEventListener("dblclick", (event) => {
				event.stopPropagation();
				if (state.deleteMode) return;
				startBucketRename(bucket, header);
			});

			const renameButton = header.querySelector(".bucket-rename-button");
			renameButton?.addEventListener("click", (event) => {
				event.stopPropagation();
				if (state.deleteMode) return;
				startBucketRename(bucket, header);
			});

			const colorButton = header.querySelector(".bucket-color-button");
			colorButton?.addEventListener("click", (event) => {
				event.stopPropagation();
				if (state.deleteMode) return;
				handleBucketRecolor(bucket);
			});
		}

		wrapper.appendChild(header);
		wrapper.appendChild(courseList);
		dom.sidebarBuckets.appendChild(wrapper);
	}
}

export function buildBucketGroups(courses, buckets) {
	const unsortedKey = "unsorted";
	const unsortedBucket = {
		id: null,
		name: "Unsorted",
		color: "#9ca3af",
		priority: -Infinity,
	};
	const groups = {
		[unsortedKey]: {
			bucket: unsortedBucket,
			courses: [],
		},
	};

	const orderedBuckets = [...buckets].sort(
		(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
	);

	for (const bucket of orderedBuckets) {
		groups[bucket.id] = {
			bucket,
			courses: [],
		};
	}

	for (const course of courses) {
		const key = course.bucket ?? unsortedKey;
		if (groups[key]) {
			groups[key].courses.push(course);
		} else {
			groups[unsortedKey].courses.push(course);
		}
	}

	return groups;
}

export function buildBucketMap(buckets) {
	const map = new Map();
	for (const bucket of buckets) {
		if (bucket?.id) {
			map.set(bucket.id, bucket);
		}
	}
	return map;
}

export function renderPlanningTray(plannedCourses, bucketMap) {
	dom.sidebarPlanner.innerHTML = "";
	if (plannedCourses.length === 0) {
		const empty = document.createElement("p");
		empty.className = "tray-empty";
		empty.textContent =
			"// nothing queued — drag from buckets or use the + icons";
		dom.sidebarPlanner.appendChild(empty);
		return;
	}

	for (const course of plannedCourses) {
		const chip = document.createElement("div");
		chip.className = "planner-course-chip";
		chip.dataset.courseId = course.id;
		chip.style.borderLeftColor = courseCodeToColor(course.courseCode);
		chip.setAttribute(
			"aria-label",
			`${course.courseCode} — ${course.title || "Untitled"}`,
		);

		const details = document.createElement("div");
		details.className = "planner-course-details";
		const code = document.createElement("span");
		code.className = "planner-course-code";
		code.textContent = course.courseCode;
		const title = document.createElement("span");
		title.className = "planner-course-title";
		title.textContent = course.title || "Untitled";
		details.append(code, title);

		const actions = document.createElement("div");
		actions.className = "planner-course-actions";

		if (isCourseOnline(course)) {
			const onlineTag = document.createElement("span");
			onlineTag.className = "course-online-tag";
			onlineTag.textContent = "~online";
			onlineTag.title = "Online course";
			actions.appendChild(onlineTag);
		}

		const bucketInfo = course.bucket ? bucketMap.get(course.bucket) : null;
		if (bucketInfo) {
			const tag = document.createElement("span");
			tag.className = "planner-bucket-tag";
			tag.textContent = bucketInfo.name;
			if (bucketInfo.color) {
				tag.style.backgroundColor = `${bucketInfo.color}22`;
				tag.style.color = bucketInfo.color;
			}
			actions.appendChild(tag);
		}

		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "course-icon-btn course-icon-btn--remove";
		removeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
		removeButton.ariaLabel = "Remove from calendar";
		removeButton.title = "Remove from calendar";
		removeButton.addEventListener("click", (event) => {
			event.stopPropagation();
			handlePlannerRemove(course.id);
		});
		actions.appendChild(removeButton);

		chip.append(details, actions);
		dom.sidebarPlanner.appendChild(chip);
	}
}
