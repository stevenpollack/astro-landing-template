/**
 * Infrastructure-as-code for the parts that previously had to be clicked
 * together by hand: the Cloudflare Turnstile widget (+ hostname allowlist) and,
 * with `--setup-gh`, the GitHub Actions secrets CI needs.
 *
 * This is invoked by `scripts/bootstrap.ts`, which sequences it with the proven
 * `astro build` + `wrangler deploy` (the Worker itself is still shipped by
 * wrangler, unchanged). State lives locally in `.alchemy/` (committed, secrets
 * encrypted with `ALCHEMY_PASSWORD`).
 *
 * Outputs the widget's keys to `.turnstile.json` (gitignored) so the bootstrap
 * can inline the public sitekey at build time and push the secret to the Worker.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import alchemy from "alchemy";
import { GitHubSecret } from "alchemy/github";
import { TurnstileWidget } from "./alchemy/turnstile.ts";
import { site } from "./src/config.ts";

const WORKER_NAME = "astro-landing-template";
// Custom domain comes from config.ts (the one place); the placeholder means none.
const domain = site.domain !== "acme.example" ? site.domain : undefined;

const app = await alchemy(WORKER_NAME);
const destroying = process.argv.includes("--destroy");

const turnstile = await TurnstileWidget("contact", {
	name: WORKER_NAME,
	workerName: WORKER_NAME,
	domains: domain ? [domain, `www.${domain}`] : [],
});

// Hand the keys to the bootstrap: sitekey (public → build) + secret (→ Worker
// secret). Gitignored; only the public sitekey is also published to CI/GitHub.
// Skip during --destroy, where the widget (and its outputs) no longer exist.
if (!destroying) {
	writeFileSync(
		".turnstile.json",
		`${JSON.stringify(
			{ sitekey: turnstile.sitekey, secret: turnstile.secret.unencrypted },
			null,
			2,
		)}\n`,
	);
}

// `--setup-gh` (SETUP_GH=1): provision the only secrets CI needs — the Cloudflare
// deploy credentials. Everything else is either committed (the public sitekey +
// domain live in src/config.ts) or already on the Worker (runtime secrets, set by
// the bootstrap and persisted across deploys). CI never handles them.
if (process.env.SETUP_GH) {
	const [owner, repository] = repoSlug().split("/");
	const ciSecrets: Record<string, string | undefined> = {
		CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
		CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
	};
	for (const [name, value] of Object.entries(ciSecrets)) {
		if (!value) continue;
		await GitHubSecret(`gh-${name}`, {
			owner,
			repository,
			name,
			value: alchemy.secret(value),
			token: alchemy.secret(process.env.GITHUB_TOKEN),
		});
	}
}

await app.finalize();

/** "owner/repo", from $GITHUB_REPOSITORY (CI) or the git origin remote. */
function repoSlug(): string {
	if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
	const url = execSync("git remote get-url origin", {
		encoding: "utf8",
	}).trim();
	const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
	if (!match) {
		throw new Error(
			`Could not derive owner/repo from git remote "${url}". ` +
				"Set GITHUB_REPOSITORY=owner/repo.",
		);
	}
	return match[1];
}
