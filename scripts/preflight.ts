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
	console.log("✓ preflight: environment and Cloudflare token OK");
}

if (import.meta.main) {
	await preflight({ setupGh: process.argv.includes("--setup-gh") });
}
