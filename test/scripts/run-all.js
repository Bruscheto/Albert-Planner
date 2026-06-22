import { spawnSync } from "node:child_process";

const testScripts = [
	"test:albert-intake",
	"test:course-metadata-effects",
	"test:course-storage",
	"test:planner-session",
	"test:weekly-schedule-model",
	"test:rmp-matcher",
];

const packageManagerExec = process.env.npm_execpath;
const command = packageManagerExec
	? process.execPath
	: process.platform === "win32"
		? "npm.cmd"
		: "npm";
const baseArgs = packageManagerExec ? [packageManagerExec] : [];

for (const script of testScripts) {
	const result = spawnSync(command, [...baseArgs, "run", script], {
		stdio: "inherit",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
