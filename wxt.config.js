import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: ".",
	entrypointsDir: "entrypoints",
	publicDir: "assets",
	outDir: "dist",
	outDirTemplate: ".",
	manifestVersion: 3,
	manifest: {
		name: "Albert Planner",
		version: "1.1",
		description:
			"Turn your Albert shopping cart into a weekly calendar with professor ratings and conflict detection.",
		permissions: [
			"storage",
			"activeTab",
			"scripting",
			"contextMenus",
			"sidePanel",
		],
		host_permissions: [
			"https://sis.portal.nyu.edu/*",
			"https://sis.nyu.edu/*",
			"https://www.ratemyprofessors.com/*",
		],
		action: {
			default_title: "Albert Planner",
			default_icon: {
				16: "/icon16.png",
				48: "/icon48.png",
				128: "/icon128.png",
			},
		},
		side_panel: {
			default_path: "popup.html?mode=sidepanel",
		},
		icons: {
			16: "/icon16.png",
			48: "/icon48.png",
			128: "/icon128.png",
		},
		commands: {
			"open-planner": {
				description: "Open the weekly schedule planner",
			},
		},
		web_accessible_resources: [
			{
				resources: ["popup.html", "weekly-view.html"],
				matches: ["https://sis.portal.nyu.edu/*", "https://sis.nyu.edu/*"],
			},
		],
	},
});
