/**
 * One-command standup: clone → fill `.env` → `bun run bootstrap`.
 *
 * Sequences the pieces that have ordering dependencies:
 *   1. preflight — validate `.env` + the Cloudflare token.
 *   2. Alchemy   — create the Turnstile widget (+ GitHub secrets with --setup-gh),
 *                  writing its keys to `.turnstile.json`.
 *   3. build     — `astro build` with the real public sitekey inlined.
 *   4. ship      — `wrangler deploy` (the proven path; creates the Worker first run).
 *   5. secrets   — push the Worker's runtime secrets (persist across deploys).
 *   6. domain    — attach the custom domain + DNS when its zone is in the account.
 *
 * Re-runnable: every step is idempotent.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { site } from "../src/config.ts";
import { preflight } from "./preflight.ts";

const WORKER_NAME = "astro-landing-template";
const setupGh = process.argv.includes("--setup-gh");

await preflight({ setupGh });

// 2. Provision Turnstile (+ GitHub secrets) → writes .turnstile.json.
sh("bunx alchemy deploy", { SETUP_GH: setupGh ? "1" : "" });
const { sitekey, secret } = JSON.parse(
	readFileSync(".turnstile.json", "utf8"),
) as {
	sitekey: string;
	secret: string;
};

// 3. Persist the public sitekey to config.ts so this build — and every future
//    `bun run deploy` / CI build — inlines it (no env var needed).
writeSitekeyToConfig(sitekey);

// 4. Build, then ship the Worker with wrangler (the proven path).
sh("bunx astro build");
sh("bunx wrangler deploy");

// 5. Push runtime secrets (Cloudflare keeps them across future deploys).
putSecret("FASTMAIL_API_TOKEN", process.env.FASTMAIL_API_TOKEN);
putSecret("MAIL_FROM", process.env.MAIL_FROM);
putSecret("MAIL_TO", process.env.MAIL_TO);
putSecret("TURNSTILE_SECRET_KEY", secret);

// 6. Attach the custom domain (Cloudflare auto-creates the proxied DNS record).
if (site.domain !== "acme.example") await attachDomains(site.domain);

console.log("\n✅ Bootstrap complete.");
console.log(`   Worker:   ${WORKER_NAME}`);
console.log(`   Turnstile sitekey: ${sitekey}`);
console.log(
	"   Sitekey written to src/config.ts — commit it so CI builds inline it.",
);

/** Persist the public Turnstile sitekey into src/config.ts (committed, public). */
function writeSitekeyToConfig(sitekey: string): void {
	const path = "src/config.ts";
	const src = readFileSync(path, "utf8");
	const next = src.replace(
		/turnstileSiteKey:\s*"[^"]*"/,
		`turnstileSiteKey: "${sitekey}"`,
	);
	if (next === src) {
		console.warn(
			`! couldn't find turnstileSiteKey in ${path}; set it to ${sitekey} by hand`,
		);
		return;
	}
	writeFileSync(path, next);
	console.log(`✓ wrote Turnstile sitekey to ${path}`);
}

/** Run a command with inherited stdio and optional extra env vars. */
function sh(cmd: string, extraEnv: Record<string, string> = {}): void {
	console.log(`\n$ ${cmd}`);
	execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

/** Push a Worker secret via wrangler (value piped on stdin; skips if empty). */
function putSecret(name: string, value: string | undefined): void {
	if (!value) {
		console.warn(`! skipping empty secret ${name}`);
		return;
	}
	console.log(`\n$ wrangler secret put ${name}`);
	execSync(`bunx wrangler secret put ${name}`, {
		input: value,
		stdio: ["pipe", "inherit", "inherit"],
		env: process.env,
	});
}

/** Attach apex + www custom domains to the Worker (no-op if the zone is absent). */
async function attachDomains(domain: string): Promise<void> {
	const token = process.env.CLOUDFLARE_API_TOKEN as string;
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID as string;
	const zoneId = await zoneIdFor(domain, token);
	if (!zoneId) {
		console.warn(
			`\n! No Cloudflare zone for "${domain}" in this account — skipping custom ` +
				"domain. The site stays on its *.workers.dev URL; add the zone and re-run to attach it.",
		);
		return;
	}
	for (const hostname of [domain, `www.${domain}`]) {
		const res = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					zone_id: zoneId,
					hostname,
					service: WORKER_NAME,
					environment: "production",
				}),
			},
		);
		if (!res.ok) {
			throw new Error(
				`Failed to attach custom domain ${hostname} (${res.status}): ${await res.text()}`,
			);
		}
		console.log(`✓ attached custom domain ${hostname}`);
	}
}

/** Resolve a domain's zone id, or null when it isn't in the account. */
async function zoneIdFor(name: string, token: string): Promise<string | null> {
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(name)}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!res.ok) return null;
	const body = (await res.json()) as { result?: { id: string }[] };
	return body.result?.[0]?.id ?? null;
}
