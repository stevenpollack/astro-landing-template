import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { site } from "../../config";
import { sendEmail } from "../../lib/fastmail";
import { verifyTurnstile } from "../../lib/turnstile";

// On-demand route — deployed as the Worker entrypoint, not prerendered.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(form: FormData, name: string): string {
  return (form.get(name) ?? "").toString().trim();
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  const ok = () =>
    wantsJson
      ? Response.json({ ok: true })
      : new Response(null, { status: 303, headers: { Location: "/thanks" } });

  const fail = (status: number, message: string) =>
    wantsJson
      ? Response.json({ error: message }, { status })
      : new Response(null, { status: 303, headers: { Location: "/#contact" } });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid form submission.");
  }

  // Honeypot: real users never fill this. Pretend success so bots don't probe.
  if (field(form, "company")) {
    return ok();
  }

  const name = field(form, "name");
  const email = field(form, "email");
  const message = field(form, "message");

  if (!name || !email || !message) {
    return fail(400, "Please fill in your name, email and message.");
  }
  if (!EMAIL_RE.test(email)) {
    return fail(400, "Please enter a valid email address.");
  }

  // Spam check — only enforced when a Turnstile secret is configured.
  if (env.TURNSTILE_SECRET_KEY) {
    const token = field(form, "cf-turnstile-response");
    const ip = request.headers.get("CF-Connecting-IP") ?? clientAddress;
    const passed = token && (await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip));
    if (!passed) {
      return fail(400, "Spam check failed. Please try again.");
    }
  }

  if (!env.FASTMAIL_API_TOKEN || !env.MAIL_FROM || !env.MAIL_TO) {
    console.error("Contact form is missing FASTMAIL_API_TOKEN / MAIL_FROM / MAIL_TO");
    return fail(500, "The contact form isn't configured yet. Please email us directly.");
  }

  const phone = field(form, "phone");
  const suburb = field(form, "suburb");
  const service = field(form, "service");

  const text = [
    `New quote request from ${name}`,
    "",
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Phone:   ${phone || "—"}`,
    `Suburb:  ${suburb || "—"}`,
    `Service: ${service || "—"}`,
    "",
    "Message:",
    message,
    "",
    `— Sent via ${site.domain} contact form`,
  ].join("\n");

  try {
    await sendEmail(env.FASTMAIL_API_TOKEN, {
      from: env.MAIL_FROM,
      to: env.MAIL_TO,
      replyTo: { name, email },
      subject: `New quote request from ${name}`,
      text,
    });
  } catch (error) {
    console.error("Failed to send contact email:", error);
    return fail(502, "Sorry — we couldn't send your message. Please try again shortly.");
  }

  return ok();
};
