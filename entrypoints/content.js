import { defineContentScript } from "wxt/utils/define-content-script";
import "../src/content/content.css";

export default defineContentScript({
	matches: ["https://sis.portal.nyu.edu/*", "https://sis.nyu.edu/*"],
	runAt: "document_idle",
	allFrames: true,
	matchAboutBlank: true,
	main() {
		import("../src/content/content.js");
	},
});
