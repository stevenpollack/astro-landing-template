/**
 * Generate `.dev.vars` from `.env` so secrets live in ONE place.
 *
 * `@astrojs/cloudflare` reads `.dev.vars` (not `.env`) for the Worker's runtime
 * bindings during `astro dev`. This mirrors the relevant keys from `.env` — the
 * single secret source — into a generated, gitignored `.dev.vars`, so you only
 * ever edit `.env`. Runs before `bun run dev`; no-ops when `.env` is absent.
 */
import { existsSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) {
  console.warn(
    "! no .env found — skipping .dev.vars (the contact form won't be configured in dev)",
  );
  process.exit(0);
}

// Bun auto-loads .env into process.env.
const lines = [
  `FASTMAIL_API_TOKEN="${process.env.FASTMAIL_API_TOKEN ?? ""}"`,
  `MAIL_FROM="${process.env.MAIL_FROM ?? ""}"`,
  `MAIL_TO="${process.env.MAIL_TO ?? ""}"`,
  // Always-pass test secret so the local Turnstile path succeeds; blank disables it.
  `TURNSTILE_SECRET_KEY="${process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA"}"`,
];
writeFileSync(".dev.vars", `${lines.join("\n")}\n`);
console.log("✓ generated .dev.vars from .env");
