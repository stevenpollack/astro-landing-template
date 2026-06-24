/*
 * Minimal Fastmail JMAP client — just enough to send one plain-text email.
 * Docs: https://www.fastmail.com/dev/  ·  JMAP: RFC 8620 (core) + RFC 8621 (mail).
 *
 * Flow: discover the session, look up the sending identity + Drafts mailbox, then
 * create a draft and submit it in a single request. Uses only `fetch`, so it runs
 * unchanged on Cloudflare Workers.
 */

const SESSION_URL = "https://api.fastmail.com/jmap/session";

const CAPABILITIES = [
	"urn:ietf:params:jmap:core",
	"urn:ietf:params:jmap:mail",
	"urn:ietf:params:jmap:submission",
];

interface Session {
	apiUrl: string;
	accountId: string;
}

interface EmailAddress {
	name?: string;
	email: string;
}

interface Identity {
	id: string;
	email: string;
	name?: string;
}

export interface SendEmailInput {
	/** Verified Fastmail address to send as (must match an account identity). */
	from: string;
	/** Where the message is delivered (your inbox). */
	to: string;
	/** Visitor's address, set as Reply-To so replies go straight to them. */
	replyTo: EmailAddress;
	subject: string;
	text: string;
}

async function getSession(token: string): Promise<Session> {
	const res = await fetch(SESSION_URL, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		throw new Error(`JMAP session request failed (${res.status})`);
	}
	const data = (await res.json()) as {
		apiUrl: string;
		primaryAccounts: Record<string, string>;
	};
	const accountId = data.primaryAccounts["urn:ietf:params:jmap:mail"];
	if (!data.apiUrl || !accountId) {
		throw new Error("JMAP session missing apiUrl or mail account");
	}
	return { apiUrl: data.apiUrl, accountId };
}

async function jmapRequest(
	session: Session,
	token: string,
	methodCalls: unknown[],
): Promise<{ methodResponses: [string, Record<string, unknown>, string][] }> {
	const res = await fetch(session.apiUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ using: CAPABILITIES, methodCalls }),
	});
	if (!res.ok) {
		throw new Error(`JMAP API request failed (${res.status})`);
	}
	return res.json() as Promise<{
		methodResponses: [string, Record<string, unknown>, string][];
	}>;
}

/** Resolve the identity id matching `from` and the Drafts mailbox id. */
async function resolveSendContext(
	session: Session,
	token: string,
	from: string,
): Promise<{ identityId: string; draftsId: string }> {
	const { methodResponses } = await jmapRequest(session, token, [
		["Identity/get", { accountId: session.accountId }, "i"],
		[
			"Mailbox/query",
			{ accountId: session.accountId, filter: { role: "drafts" } },
			"m",
		],
	]);

	const identities =
		(methodResponses.find((r) => r[2] === "i")?.[1].list as
			| Identity[]
			| undefined) ?? [];
	const match =
		identities.find((id) => id.email?.toLowerCase() === from.toLowerCase()) ??
		identities[0];
	if (!match?.id) {
		throw new Error(`No Fastmail identity found for ${from}`);
	}

	const draftsId = (
		methodResponses.find((r) => r[2] === "m")?.[1].ids as string[] | undefined
	)?.[0];
	if (!draftsId) {
		throw new Error("No Drafts mailbox found");
	}

	return { identityId: match.id, draftsId };
}

export async function sendEmail(
	token: string,
	input: SendEmailInput,
): Promise<void> {
	const session = await getSession(token);
	const { identityId, draftsId } = await resolveSendContext(
		session,
		token,
		input.from,
	);

	const { methodResponses } = await jmapRequest(session, token, [
		[
			"Email/set",
			{
				accountId: session.accountId,
				create: {
					draft: {
						mailboxIds: { [draftsId]: true },
						keywords: { $draft: true },
						from: [{ email: input.from }],
						to: [{ email: input.to }],
						replyTo: [input.replyTo],
						subject: input.subject,
						bodyStructure: { type: "text/plain", partId: "body" },
						bodyValues: { body: { value: input.text } },
					},
				},
			},
			"e",
		],
		[
			"EmailSubmission/set",
			{
				accountId: session.accountId,
				onSuccessDestroyEmail: ["#sub"],
				create: {
					sub: { emailId: "#draft", identityId },
				},
			},
			"s",
		],
	]);

	// Surface any JMAP-level failure as an error so the endpoint returns 502.
	for (const [name, args] of methodResponses) {
		if (name === "error") {
			throw new Error(`JMAP error: ${JSON.stringify(args)}`);
		}
		const notCreated = (args as { notCreated?: Record<string, unknown> })
			.notCreated;
		if (notCreated && Object.keys(notCreated).length > 0) {
			throw new Error(`JMAP send rejected: ${JSON.stringify(notCreated)}`);
		}
	}
}
