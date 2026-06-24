/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

// Server-side secrets (Cloudflare vars/secrets), set via .dev.vars locally and
// pushed to the Worker by the bootstrap. Augments the wrangler-generated
// Cloudflare.Env so the `env` from "cloudflare:workers" is typed in the contact
// endpoint.
declare namespace Cloudflare {
  interface Env {
    FASTMAIL_API_TOKEN: string;
    MAIL_FROM: string;
    MAIL_TO: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}
