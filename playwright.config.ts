import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against an already-deployed URL (a Workers preview or production),
// passed in via BASE_URL — there is no local web server to manage here.
const baseURL = process.env.BASE_URL ?? "http://localhost:4321";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: "line",
	timeout: 30_000,
	use: {
		baseURL,
		trace: "off",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
