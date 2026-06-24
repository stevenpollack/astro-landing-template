// @ts-check

import cloudflare from "@astrojs/cloudflare";
import { defineConfig, sessionDrivers } from "astro/config";
import { site } from "./src/config.ts";

// https://astro.build/config
export default defineConfig({
	// Canonical/sitemap URL — single source of truth in src/config.ts (same value
	// the <link rel="canonical"> uses), so there's nothing to set here by hand.
	site: site.url,
	// Static by default; only /api/contact opts into on-demand rendering
	// (export const prerender = false) and ships as the Worker entrypoint.
	output: "static",
	// This site doesn't use Astro sessions. Without this, @astrojs/cloudflare
	// defaults the session store to a Cloudflare KV binding ("SESSION"), which
	// adds unused KV cruft to the Worker and forces Workers KV Storage onto the
	// deploy token. The inert in-memory driver opts out of that binding.
	session: { driver: sessionDrivers.lruCache() },
	// The adapter runs the dev/build worker in workerd via @cloudflare/vite-plugin,
	// so `.dev.vars` are available through `import { env } from "cloudflare:workers"`.
	// imageService: 'passthrough' — the site has no dynamic <Image> usage, so skip the
	// Cloudflare Images binding (keeps the deploy API token's permissions minimal).
	adapter: cloudflare({ imageService: "passthrough" }),
});
