// Planner selection and bucket mutations (create, recolor, rename, delete).

import {
  addCourseToPlannerSelection,
  createBucket,
  deleteBucket,
  getBuckets,
  removeCourseFromPlannerSelection,
  updateBucket,
} from "../storage/course-storage.js";
import {
	clearActiveRename,
	clearPendingBucketDeletions,
	getActiveRenameState,
	getDeleteBucketButton,
	getPendingBucketDeletionCount,
	getPendingBucketDeletionIds,
	isDeleteMode,
	isPlannerCourseSelected,
	removeBucketCollapseState,
	reloadSchedule,
	setActiveRenameState,
	setDeleteMode,
	togglePendingBucketDeletion,
} from "./runtime.js";
import { showModal, showToast } from "./ui-feedback.js";

export async function handlePlannerAdd(courseId) {
	if (!courseId || isPlannerCourseSelected(courseId)) return;
	await addCourseToPlannerSelection(courseId);
	await reloadSchedule();
}

export async function handlePlannerRemove(courseId) {
	if (!courseId) return;
	await removeCourseFromPlannerSelection(courseId);
	await reloadSchedule();
}

export async function handleBucketCreate() {
	const content = document.createElement("div");
	content.className = "input-group";
	content.innerHTML = `
        <label class="input-label">Bucket Name</label>
        <input type="text" class="input-field" id="bucket-name-input" placeholder="e.g. Core Requirements" autofocus>
    `;

	// Focus input after modal opens
	setTimeout(() => {
		const input = document.getElementById("bucket-name-input");
		if (input) input.focus();
	}, 100);

	const result = await showModal("// new bucket", content, [
		{ label: "cancel", value: null },
		{ label: "create", value: "create", primary: true },
	]);

	if (result !== "create") return;

	const nameInput = document.getElementById("bucket-name-input");
	const trimmedName = nameInput.value.trim();

	if (!trimmedName) {
		showToast("Bucket name cannot be empty", "error");
		return;
	}

	const buckets = await getBuckets();
	const maxPriority = buckets.reduce(
		(max, bucket) => Math.max(max, bucket.priority ?? 0),
		0,
	);

	// Default color
	const defaultColor = "#57068c";

	await createBucket({
		name: trimmedName,
		color: defaultColor,
		priority: maxPriority + 1,
	});
	await reloadSchedule();
	showToast("Bucket created successfully", "success");
}

export async function handleBucketRecolor(bucket) {
	const palette = [
		{ hex: "#57068c", name: "purple" },
		{ hex: "#ef4444", name: "red" },
		{ hex: "#f97316", name: "orange" },
		{ hex: "#f59e0b", name: "amber" },
		{ hex: "#84cc16", name: "lime" },
		{ hex: "#10b981", name: "emerald" },
		{ hex: "#06b6d4", name: "cyan" },
		{ hex: "#3b82f6", name: "blue" },
		{ hex: "#6366f1", name: "indigo" },
		{ hex: "#d946ef", name: "fuchsia" },
	];

	const normalizedCurrent = (bucket.color || "").toLowerCase();

	const content = document.createElement("div");
	content.className = "color-picker";

	const grid = document.createElement("div");
	grid.className = "color-grid";
	content.appendChild(grid);

	const saveColor = async (color) => {
		if (color !== bucket.color) {
			await updateBucket(bucket.id, { color });
			await reloadSchedule();
			showToast("Bucket color updated", "success");
		}
		const closeBtn = document.getElementById("modal-close");
		if (closeBtn) closeBtn.click();
	};

	palette.forEach(({ hex, name }) => {
		const option = document.createElement("button");
		option.type = "button";
		option.className = "color-option";
		option.setAttribute("aria-label", `${name} — ${hex}`);
		option.title = `${name} · ${hex}`;

		const isSelected = hex.toLowerCase() === normalizedCurrent;
		if (isSelected) {
			option.classList.add("is-selected");
			option.setAttribute("aria-pressed", "true");
		} else {
			option.setAttribute("aria-pressed", "false");
		}

		option.innerHTML = `
			<span class="color-option-swatch" style="background: ${hex}">
				<svg class="color-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
			</span>
			<span class="color-option-meta">
				<span class="color-option-name">${name}</span>
				<span class="color-option-hex">${hex}</span>
			</span>
		`;

		option.addEventListener("click", () => saveColor(hex));
		grid.appendChild(option);
	});

	await showModal("// bucket color", content);
}

export function cancelInlineRename() {
	const activeRenameState = getActiveRenameState();
	if (activeRenameState?.cancel) {
		activeRenameState.cancel();
	}
}

export function startBucketRename(bucket, headerEl) {
	if (!bucket?.id || isDeleteMode()) return;

	const activeRenameState = getActiveRenameState();
	if (
		activeRenameState?.bucketId &&
		activeRenameState.bucketId !== bucket.id
	) {
		cancelInlineRename();
	} else if (activeRenameState?.bucketId === bucket.id) {
		return;
	}

	const labelEl = headerEl.querySelector(".bucket-label");
	if (!labelEl) return;

	const renameContainer = document.createElement("div");
	renameContainer.className = "bucket-rename-inline";
	const input = document.createElement("input");
	input.type = "text";
	input.value = bucket.name ?? "";
	input.className = "bucket-rename-input";
	input.setAttribute("maxlength", "80");

	renameContainer.appendChild(input);
	labelEl.replaceWith(renameContainer);

	const cancel = () => {
		if (!renameContainer.isConnected) {
			clearActiveRename();
			return;
		}
		renameContainer.replaceWith(labelEl);
		clearActiveRename();
	};

	const commit = async () => {
		const nextName = input.value.trim();
		if (!nextName) {
			// If empty, just cancel
			cancel();
			return;
		}
		if (nextName === bucket.name) {
			cancel();
			return;
		}

		input.disabled = true;
		try {
			await updateBucket(bucket.id, { name: nextName });
		} catch (error) {
			console.error("[Albert Enhancer] Failed to rename bucket", error);
		}
		clearActiveRename();
		await reloadSchedule();
	};

	input.addEventListener("click", (event) => event.stopPropagation());

	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			input.blur(); // Trigger blur to save
		} else if (event.key === "Escape") {
			event.preventDefault();
			cancel();
		}
	});

	input.addEventListener("blur", () => {
		commit();
	});

	renameContainer.addEventListener("click", (event) => event.stopPropagation());

	setActiveRenameState({
		bucketId: bucket.id,
		cancel,
		container: renameContainer,
	});
	input.focus();
	input.select();
}

export function toggleBucketDeleteSelection(bucketId, headerEl) {
	if (!bucketId) return;
	const isSelected = togglePendingBucketDeletion(bucketId);
	const pill = headerEl.querySelector(".bucket-delete-select");
	if (isSelected) {
		headerEl.classList.add("is-selected-for-delete");
		pill?.classList.add("is-selected");
		if (pill) pill.textContent = "✓";
	} else {
		headerEl.classList.remove("is-selected-for-delete");
		pill?.classList.remove("is-selected");
		if (pill) pill.textContent = "";
	}
	updateDeleteButtonState();
}

export function enterDeleteMode() {
	setDeleteMode(true);
	clearPendingBucketDeletions();
	getDeleteBucketButton()?.classList.add("is-active");
	updateDeleteButtonState();
	reloadSchedule();
}

export function exitDeleteMode() {
	setDeleteMode(false);
	clearPendingBucketDeletions();
	getDeleteBucketButton()?.classList.remove("is-active");
	updateDeleteButtonState();
	reloadSchedule();
}

export function updateDeleteButtonState() {
	const deleteButton = getDeleteBucketButton();
	if (!deleteButton) return;

	const trashIcon = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="3 6 5 6 21 6"></polyline>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
		</svg>
	`;

	const cancelIcon = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="18" y1="6" x2="6" y2="18"></line>
			<line x1="6" y1="6" x2="18" y2="18"></line>
		</svg>
	`;

	if (!isDeleteMode()) {
		deleteButton.innerHTML = trashIcon;
		deleteButton.title = "Delete Buckets";
		return;
	}

	const count = getPendingBucketDeletionCount();
	if (count === 0) {
		deleteButton.innerHTML = cancelIcon;
		deleteButton.title = "Cancel Delete Mode";
	} else {
		deleteButton.innerHTML = trashIcon;
		deleteButton.title = `Delete ${count} Selected Bucket${
			count > 1 ? "s" : ""
		}`;
	}
}

export async function deleteSelectedBuckets() {
	const ids = getPendingBucketDeletionIds();
	if (!ids.length) return;
	const message =
		ids.length === 1
			? "Delete selected bucket? Its courses will move to Unsorted."
			: `Delete ${ids.length} buckets? Their courses will move to Unsorted.`;

	const confirmed = await showModal("// delete buckets", message, [
		{ label: "cancel", value: false },
		{ label: "delete", value: true, danger: true },
	]);

	if (!confirmed) return;

	for (const bucketId of ids) {
		await deleteBucket(bucketId);
		removeBucketCollapseState(bucketId);
	}
	exitDeleteMode();
	await reloadSchedule();
}
