// Export the rendered calendar to a PNG via an SVG <foreignObject> snapshot.

import {
	getCalendarContainer,
	getExportCalendarButton,
} from "./runtime.js";
import { showToast } from "./ui-feedback.js";

export async function handleExportCalendar() {
	const exportButton = getExportCalendarButton();
	if (!exportButton) return;
	const calendarEl = getCalendarContainer();
	if (!calendarEl) {
		showToast("Calendar not ready", "error");
		return;
	}

	const originalLabel = exportButton.querySelector(
		".header-action-btn-label",
	)?.textContent;
	exportButton.disabled = true;
	const labelEl = exportButton.querySelector(".header-action-btn-label");
	if (labelEl) labelEl.textContent = "rendering";

	try {
		const blob = await renderElementToPng(calendarEl);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		const stamp = new Date().toISOString().slice(0, 10);
		a.href = url;
		a.download = `albert-calendar-${stamp}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		showToast("Calendar exported", "success");
	} catch (error) {
		console.error("[Albert Enhancer] Calendar export failed:", error);
		showToast("Export failed", "error");
	} finally {
		exportButton.disabled = false;
		if (labelEl && originalLabel) labelEl.textContent = originalLabel;
	}
}

function collectDocumentStyles() {
	const parts = [];
	for (const sheet of document.styleSheets) {
		try {
			const rules = sheet.cssRules;
			if (!rules) continue;
			for (const rule of rules) {
				parts.push(rule.cssText);
			}
		} catch {
			// cross-origin stylesheet — skip silently
		}
	}
	return parts.join("\n");
}

async function renderElementToPng(element) {
	const width = Math.max(element.scrollWidth, element.clientWidth);
	const height = Math.max(element.scrollHeight, element.clientHeight);
	const scale = window.devicePixelRatio > 1 ? 2 : 1;

	const clone = element.cloneNode(true);
	clone.querySelectorAll(".calendar-drag-overlay").forEach((el) => el.remove());
	clone.style.width = `${width}px`;
	clone.style.height = `${height}px`;
	clone.style.overflow = "visible";

	const cssText = collectDocumentStyles().replace(/]]>/g, "]]]]><![CDATA[>");
	const bodyBg =
		getComputedStyle(document.body).backgroundColor || "#ffffff";

	const serializer = new XMLSerializer();
	const cloneHtml = serializer.serializeToString(clone);

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<foreignObject x="0" y="0" width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${bodyBg};">
<style><![CDATA[${cssText}]]></style>
${cloneHtml}
</div>
</foreignObject>
</svg>`;

	const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
	const parseError = parsed.querySelector("parsererror");
	if (parseError) {
		console.error("[Albert Enhancer] SVG parse error:", parseError.textContent);
		console.error("[Albert Enhancer] Offending SVG (first 2000 chars):", svg.slice(0, 2000));
		throw new Error(`SVG parse error: ${parseError.textContent.slice(0, 200)}`);
	}

	const encoded = encodeURIComponent(svg)
		.replace(/'/g, "%27")
		.replace(/"/g, "%22");
	const svgUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;

	const img = new Image();
	await new Promise((resolve, reject) => {
		img.onload = resolve;
		img.onerror = (event) => {
			console.error("[Albert Enhancer] img.onerror event:", event);
			console.error("[Albert Enhancer] SVG length:", svg.length);
			console.error("[Albert Enhancer] SVG head:", svg.slice(0, 500));
			console.error("[Albert Enhancer] SVG tail:", svg.slice(-500));
			reject(new Error("SVG image failed to load"));
		};
		img.src = svgUrl;
	});

	const canvas = document.createElement("canvas");
	canvas.width = width * scale;
	canvas.height = height * scale;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = bodyBg;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.drawImage(img, 0, 0);

	return await new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Canvas toBlob returned null"));
		}, "image/png");
	});
}
