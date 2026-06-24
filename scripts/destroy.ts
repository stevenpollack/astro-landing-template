/**
 * Tear down everything `bun run bootstrap` stood up, in one command:
 *   1. Alchemy-managed resources — the Turnstile widget (+ CI secrets, if you
 *      used --setup-gh) — via `alchemy destroy`.
 *   2. The Worker itself — deleted straight through the Cloudflare API; its
 *      secrets (and custom domains) go with it.
 *
 * The Worker is deleted via the API rather than `wrangler delete` on purpose:
 * `wrangler delete` also LISTS KV namespaces (for legacy Workers Sites cleanup),
 * which needs an Account › Workers KV Storage permission the deploy token doesn't
 * have. The script-delete endpoint needs only Workers Scripts: Edit.
 *
 * Idempotent: an already-deleted Worker is treated as success.
 */
import { execSync } from "node:child_process";

const WORKER_NAME = "astro-landing-template";
const failures: string[] = [];

console.log("→ Destroying Alchemy-managed resources (Turnstile, CI secrets)…");
try {
	execSync("bunx alchemy destroy", { stdio: "inherit", env: process.env });
} catch {
	failures.push("alchemy destroy");
}

console.log("\n→ Deleting the Worker…");
try {
	await deleteWorker();
} catch (err) {
	failures.push("delete worker");
	console.error(err instanceof Error ? err.message : String(err));
}

if (failures.length > 0) {
	console.error(`\n⚠ Teardown finished with errors: ${failures.join(", ")}`);
	process.exit(1);
}
console.log("\n✅ Teardown complete — all infrastructure removed.");

/** Delete the Worker via the Cloudflare API (needs only Workers Scripts: Edit). */
async function deleteWorker(): Promise<void> {
	const token = process.env.CLOUDFLARE_API_TOKEN;
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !accountId) {
		throw new Error(
			"CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (in .env).",
		);
	}
	// `force=true` deletes the script even if other services reference it.
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}?force=true`,
		{ method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
	);
	if (res.ok) {
		console.log(`  deleted Worker ${WORKER_NAME}`);
		return;
	}
	const body = await res.text();
	// 404 / error 10007 = the script doesn't exist → already torn down.
	if (res.status === 404 || body.includes("10007")) {
		console.log("  Worker already gone — nothing to delete.");
		return;
	}
	throw new Error(
		`Failed to delete Worker ${WORKER_NAME} (${res.status}): ${body}`,
	);
}
