import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const rootDir = import.meta.dirname;
const outDir = resolve(rootDir, "dist");

const staticResources = [
	["manifest.json", "manifest.json"],
	["assets", "assets"],
	["src/chrome-mock.js", "src/chrome-mock.js"],
	["src/content.css", "src/content.css"],
	["src/content.js", "src/content.js"],
	["src/course-metadata-panel.css", "src/course-metadata-panel.css"],
	["src/popup.css", "src/popup.css"],
	["src/weekly-view.css", "src/weekly-view.css"],
	["src/course-storage.js", "src/course-storage.js"],
	["src/planner.js", "src/planner.js"],
	["src/bucket-manager.js", "src/bucket-manager.js"],
	["src/course-metadata-panel.js", "src/course-metadata-panel.js"],
	["src/utils", "src/utils"],
	["src/weekly-view", "src/weekly-view"],
];

function copyExtensionResources() {
	return {
		name: "copy-extension-resources",
		closeBundle: async () => {
			await mkdir(outDir, { recursive: true });
			await Promise.all(
				staticResources.map(([from, to]) =>
					cp(resolve(rootDir, from), resolve(outDir, to), {
						recursive: true,
						force: true,
					}),
				),
			);
		},
	};
}

export default defineConfig({
	base: "./",
	publicDir: false,
	plugins: [copyExtensionResources()],
	build: {
		outDir,
		emptyOutDir: true,
		target: "es2022",
		modulePreload: false,
		rollupOptions: {
			input: {
				"src/background": resolve(rootDir, "src/background.js"),
				"src/popup": resolve(rootDir, "src/popup.html"),
				"src/weekly-view": resolve(rootDir, "src/weekly-view.html"),
				"test-harness": resolve(rootDir, "test-harness.html"),
			},
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "src/chunks/[name]-[hash].js",
				assetFileNames: "src/assets/[name]-[hash][extname]",
			},
		},
	},
});
