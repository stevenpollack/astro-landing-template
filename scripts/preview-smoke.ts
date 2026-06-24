/*
 * Pre-push E2E: deploy a throwaway Cloudflare Workers *preview* version (does not
 * touch production), then run the Playwright smoke tests against its preview URL.
 *
 * Skips gracefully (exit 0) when the push is docs-only, when not authenticated, or
 * when SKIP_PREVIEW_E2E is set — so contributors without Cloudflare access (or offline)
 * aren't blocked from pushing. Requires local wrangler auth (`wrangler login`) to run.
 *
 * Pushed file paths are passed as args (Lefthook's {push_files}); with none, it runs.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (
	cmd: string,
	args: string[],
	opts: { capture?: boolean; env?: NodeJS.ProcessEnv } = {},
) =>
	spawnSync(cmd, args, {
		encoding: "utf8",
		stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
		env: opts.env ?? process.env,
	});

function skip(reason: string): never {
	console.log(`\n⏭  preview smoke skipped — ${reason}`);
	process.exit(0);
}

if (process.env.SKIP_PREVIEW_E2E) skip("SKIP_PREVIEW_E2E is set");

// Skip when the push touches only docs — mirrors the workflows' paths-ignore
// (root *.md + docs/**). With no file args (e.g. a manual run) it does not skip.
const pushedFiles = process.argv.slice(2);
const isDoc = (f: string) => /^[^/]+\.md$/.test(f) || f.startsWith("docs/");
if (pushedFiles.length > 0 && pushedFiles.every(isDoc)) {
	skip("only documentation changed");
}

// 1. Need Cloudflare auth to upload a preview. In CI a missing token is a hard
// failure (don't let the gate pass without actually running); locally it just skips.
const who = run("bunx", ["wrangler", "whoami"], { capture: true });
if (
	who.status !== 0 ||
	/not authenticated|not logged in/i.test(who.stdout + who.stderr)
) {
	if (process.env.CI) {
		console.error(
			"✗ Cloudflare auth required for the e2e in CI, but wrangler is not authenticated",
		);
		process.exit(1);
	}
	skip("not logged in to Cloudflare (run `wrangler login`)");
}

// 2. Ensure there's a build to upload (pre-push already builds; this covers standalone runs).
if (!existsSync("dist/server/wrangler.json")) {
	console.log("▶ building (no dist found)…");
	if (run("bun", ["run", "build"]).status !== 0) process.exit(1);
}

// 3. Upload a preview version — production traffic is untouched.
console.log("▶ uploading preview version…");
const up = run("bunx", ["wrangler", "versions", "upload"], { capture: true });
process.stdout.write(up.stdout ?? "");
process.stderr.write(up.stderr ?? "");
if (up.status !== 0) {
	console.error("✗ preview upload failed");
	process.exit(1);
}

const out = `${up.stdout ?? ""}${up.stderr ?? ""}`;
const url =
	out.match(/Version Preview URL:\s*(\S+)/i)?.[1] ??
	out.match(/https:\/\/\S+\.workers\.dev\b/)?.[0];
if (!url) {
	console.error("✗ could not find a preview URL in wrangler output");
	process.exit(1);
}

// 4. Smoke-test the preview.
console.log(`▶ smoke testing ${url}`);
const test = run("bunx", ["playwright", "test"], {
	env: { ...process.env, BASE_URL: url },
});
process.exit(test.status ?? 1);
