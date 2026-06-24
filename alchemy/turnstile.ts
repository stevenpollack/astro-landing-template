import { type Context, Resource, type Secret, secret } from "alchemy";

/**
 * A Cloudflare Turnstile widget, managed as a custom Alchemy resource.
 *
 * Alchemy has no built-in Turnstile resource, so this wraps the CF API
 * (`/accounts/{id}/challenges/widgets`). Creating the widget yields the public
 * `sitekey` (→ build-time `PUBLIC_TURNSTILE_SITE_KEY`) and the `secret`
 * (→ the Worker's `TURNSTILE_SECRET_KEY` binding). The secret is wrapped in an
 * Alchemy `Secret` so it is encrypted in the committed `.alchemy/` state.
 */
export interface TurnstileWidgetProps {
	/** Human-readable widget name (shown in the Cloudflare dashboard). */
	name: string;
	/**
	 * Base hostname allowlist (e.g. the apex + www of a custom domain). The
	 * worker's own `*.workers.dev` host is appended automatically so the form
	 * works before/without a custom domain.
	 */
	domains: string[];
	/** Worker name, used to derive the `<name>.<subdomain>.workers.dev` host. */
	workerName: string;
	/** Widget mode. @default "managed" */
	mode?: "managed" | "non-interactive" | "invisible";
	/** Cloudflare account id. @default process.env.CLOUDFLARE_ACCOUNT_ID */
	accountId?: string;
	/** Cloudflare API token. @default process.env.CLOUDFLARE_API_TOKEN */
	apiToken?: string;
}

export interface TurnstileWidget {
	/** Public site key — safe to embed; feeds `PUBLIC_TURNSTILE_SITE_KEY`. */
	sitekey: string;
	/** Secret key — server-side only; encrypted in Alchemy state. */
	secret: Secret;
	name: string;
	domains: string[];
	mode: string;
}

// Always-pass test keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
// used for local dev so offline `alchemy dev` never touches the CF API.
const TEST_SITEKEY = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch<T>(
	path: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`${CF_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...init?.headers,
		},
	});
	const body = (await res.json().catch(() => ({}))) as {
		success?: boolean;
		result?: T;
		errors?: unknown;
	};
	if (!res.ok || body.success === false) {
		const hint =
			res.status === 403 && path.includes("challenges/widgets")
				? " — does CLOUDFLARE_API_TOKEN have the 'Account › Turnstile › Edit' permission?"
				: "";
		throw new Error(
			`Cloudflare API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${JSON.stringify(body.errors ?? body)}${hint}`,
		);
	}
	return body.result as T;
}

/** Resolve `<workerName>.<account-subdomain>.workers.dev`, or null if unset. */
async function workersDevHost(
	workerName: string,
	accountId: string,
	token: string,
): Promise<string | null> {
	const result = await cfFetch<{ subdomain?: string }>(
		`/accounts/${accountId}/workers/subdomain`,
		token,
	).catch(() => null);
	const subdomain = result?.subdomain;
	return subdomain ? `${workerName}.${subdomain}.workers.dev` : null;
}

export const TurnstileWidget = Resource(
	"astro-landing-template::TurnstileWidget",
	async function (
		this: Context<TurnstileWidget>,
		_id: string,
		props: TurnstileWidgetProps,
	): Promise<TurnstileWidget> {
		const mode = props.mode ?? "managed";

		// Local dev: never hit the CF API — fall back to the test keys from the
		// environment (the always-pass keys ship in .env.example).
		if (this.scope.local) {
			return {
				name: props.name,
				domains: props.domains,
				mode,
				sitekey: process.env.PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITEKEY,
				secret: secret(process.env.TURNSTILE_SECRET_KEY ?? TEST_SECRET),
			};
		}

		const token = props.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
		const accountId = props.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
		if (!token || !accountId) {
			throw new Error(
				"TurnstileWidget requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.",
			);
		}
		const base = `/accounts/${accountId}/challenges/widgets`;

		if (this.phase === "delete") {
			const sitekey = this.output?.sitekey;
			if (sitekey) {
				const res = await fetch(`${CF_API}${base}/${sitekey}`, {
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!res.ok && res.status !== 404) {
					throw new Error(
						`Failed to delete Turnstile widget ${sitekey} (${res.status}).`,
					);
				}
			}
			return this.destroy();
		}

		const host = await workersDevHost(props.workerName, accountId, token);
		const domains = [
			...new Set([...props.domains, host].filter((d): d is string => !!d)),
		];
		const payload = JSON.stringify({ name: props.name, domains, mode });

		// Update: the sitekey is the immutable identifier; PUT the mutable fields.
		if (this.phase === "update" && this.output?.sitekey) {
			const result = await cfFetch<{ sitekey: string; secret?: string }>(
				`${base}/${this.output.sitekey}`,
				token,
				{ method: "PUT", body: payload },
			);
			return {
				name: props.name,
				domains,
				mode,
				sitekey: result.sitekey,
				secret: result.secret ? secret(result.secret) : this.output.secret,
			};
		}

		// Create.
		const result = await cfFetch<{ sitekey: string; secret: string }>(
			base,
			token,
			{
				method: "POST",
				body: payload,
			},
		);
		return {
			name: props.name,
			domains,
			mode,
			sitekey: result.sitekey,
			secret: secret(result.secret),
		};
	},
);
