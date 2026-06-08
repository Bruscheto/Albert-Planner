// Toast and modal helpers for the weekly view (no shared state).

export function showToast(message, type = "info") {
	const container = document.getElementById("toast-container");
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.innerHTML = `
        <div class="toast-message">${message}</div>
    `;

	container.appendChild(toast);

	setTimeout(() => {
		toast.classList.add("is-hiding");
		toast.addEventListener("transitionend", () => {
			toast.remove();
		});
	}, 3000);
}

export function showModal(title, content, buttons = []) {
	return new Promise((resolve) => {
		const overlay = document.getElementById("modal-overlay");
		const titleEl = document.getElementById("modal-title");
		const bodyEl = document.getElementById("modal-body");
		const footerEl = document.getElementById("modal-footer");
		const closeBtn = document.getElementById("modal-close");
		let isResolved = false;

		titleEl.textContent = title;
		bodyEl.innerHTML = "";
		if (typeof content === "string") {
			bodyEl.innerHTML = content;
		} else {
			bodyEl.appendChild(content);
		}

		footerEl.innerHTML = "";
		buttons.forEach((btn) => {
			const button = document.createElement("button");
			if (btn.danger) {
				button.className = "btn-danger-modal";
			} else {
				button.className = btn.primary ? "btn-primary" : "btn-secondary";
			}
			button.textContent = btn.label;
			button.addEventListener("click", () => {
				closeModal(btn.value);
			});
			footerEl.appendChild(button);
		});

		function closeModal(result = null) {
			if (isResolved) {
				return;
			}
			isResolved = true;
			overlay.classList.remove("is-open");
			resolve(result);
		}

		overlay.classList.add("is-open");

		closeBtn.onclick = closeModal;
		overlay.onclick = (e) => {
			if (e.target === overlay) closeModal();
		};
	});
}
