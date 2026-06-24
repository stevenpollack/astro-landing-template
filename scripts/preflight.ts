/**
 * Fail fast before a bootstrap: assert the dotenv is filled in and the
 * Cloudflare token actually works, so problems surface here rather than
 * half-way through standing up infra.
 */
const REQUIRED = [
	"ALCHEMY_PASSWORD",
	"CLOUDFLARE_API_TOKEN",
	"CLOUDFLARE_ACCOUNT_ID",
	"FASTMAIL_API_TOKEN",
	"MAIL_FROM",
	"MAIL_TO",
] as const;

export async function preflight({
	setupGh,
}: {
	setupGh: boolean;
}): Promise<void> {
	const missing: string[] = REQUIRED.filter((k) => !process.env[k]?.trim());
	if (setupGh && !process.env.GITHUB_TOKEN?.trim())
		missing.push("GITHUB_TOKEN");
	if (missing.length) {
		throw new Error(
			`Missing required environment variables (fill them in .env):\n  - ${missing.join("\n  - ")}`,
		);
	}

	const res = await fetch(
		"https://api.cloudflare.com/client/v4/user/tokens/verify",
		{
			headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
		},
	);
	if (!res.ok) {
		throw new Error(
			`CLOUDFLARE_API_TOKEN failed verification (${res.status}). Check the token and its scopes.`,
		);
	}

	if (setupGh) await verifyGitHubToken();

	console.log("✓ preflight: environment and Cloudflare token OK");
}

/**
 * Verify GITHUB_TOKEN actually authenticates before Alchemy uses it, so a stale
 * shell value shadowing `.env` (mise/Bun don't override an already-exported var)
 * fails here with a clear message instead of a raw 401 mid-deploy.
 */
async function verifyGitHubToken(): Promise<void> {
	const res = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "astro-landing-template-bootstrap",
		},
	});
	if (res.status === 401) {
		throw new Error(
			"GITHUB_TOKEN failed GitHub auth (401 Bad credentials). The token reaching\n" +
				"this process is invalid — most likely a stale value exported in your shell is\n" +
				"shadowing the one in .env (mise/Bun won't override an already-set var). Open a\n" +
				"fresh terminal (or `unset GITHUB_TOKEN`) so .env is loaded cleanly, then retry.",
		);
	}
	if (!res.ok) {
		throw new Error(
			`GITHUB_TOKEN failed verification (${res.status}). Check the token at https://github.com/settings/tokens.`,
		);
	}
	// Classic PATs report their grants here; fine-grained tokens leave it blank.
	const scopes = res.headers.get("x-oauth-scopes") ?? "";
	const grants = scopes.split(",").map((s) => s.trim());
	if (scopes && !grants.includes("repo") && !grants.includes("public_repo")) {
		console.warn(
			`⚠ GITHUB_TOKEN scopes are "${scopes}" — writing Actions secrets needs 'repo'\n` +
				"  (private repos) or 'public_repo' (public repos). The --setup-gh step may 403.",
		);
	}
}

if (import.meta.main) {
	await preflight({ setupGh: process.argv.includes("--setup-gh") });
}
