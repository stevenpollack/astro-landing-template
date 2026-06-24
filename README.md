# Astro Landing Template

A production-ready template for a **commercial landing page with a working contact
form**. Static Astro site deployed to Cloudflare Workers; the contact form emails leads
via the Fastmail JMAP API, with spam filtered by a honeypot field + Cloudflare Turnstile.

> **This is a GitHub template.** Click **“Use this template”** to create your own repo,
> then work through [Make it yours](#make-it-yours) to replace the placeholder content.

## Stack

- **Astro 7** (static output) + **TypeScript**, run with **Bun**
- **@astrojs/cloudflare** adapter → Cloudflare Workers + static assets
- Contact form: an on-demand route (`src/pages/api/contact.ts`) that sends mail
  through **Fastmail JMAP** (`src/lib/fastmail.ts`). Spam is filtered with a
  honeypot field + **Cloudflare Turnstile**.
- **Infra as code**: [Alchemy](https://alchemy.run) (`alchemy.run.ts`) provisions the
  Turnstile widget + CI secrets; `bun run bootstrap` stands the whole thing up.

## Project layout

```
src/
├── config.ts              # All copy & business details (edit content here)
├── layouts/Base.astro     # HTML shell, <head>, fonts
├── styles/
│   ├── tokens.css         # DESIGN TOKENS — single source of truth (re-skin here)
│   ├── themes.css         # preview themes for the theme switcher (remove before launch)
│   └── global.css         # base element styles + shared .btn/.eyebrow/etc.
├── components/            # Header, Hero, Services, About, WhyUs, ContactForm, Footer, Photo
│                          # + ThemeSwitcher (preview tool — see "Theme switcher" below)
├── pages/
│   ├── index.astro        # the landing page
│   ├── thanks.astro       # no-JS success page
│   └── api/contact.ts     # form endpoint (Fastmail JMAP + Turnstile)
└── lib/                   # fastmail.ts, turnstile.ts
```

**To restyle:** edit CSS variables in `src/styles/tokens.css` — components never
hard-code colours/fonts/spacing. **To edit copy:** `src/config.ts`.

## Make it yours

All copy and visuals are **lorem-ipsum placeholders**. Replace them:

1. **Content** — edit `src/config.ts` (business name, tagline, contact details,
   services, "why us" reasons). Then sweep the components in `src/components/` for the
   inline placeholder copy (Hero headline, About story, section intros).
2. **Branding** — adjust the design tokens in `src/styles/tokens.css` (colours, fonts,
   spacing). Replace the `Photo` placeholder frames with real `<img>` photography.
3. **Domain & identifiers** — set your apex domain in `src/config.ts` (`DOMAIN`); it
   drives the canonical URL, the Turnstile allowlist, and the custom-domain attach.
   The Worker name is `astro-landing-template` in `package.json`, `wrangler.jsonc`, and
   `WORKER_NAME` in `alchemy.run.ts` / `scripts/bootstrap.ts` — rename it to your own.
4. **Favicons** — swap the files in `public/` for your own.

## Theme switcher (a preview tool — decide before launch)

The site ships with a small floating **theme switcher** (bottom-right) that re-skins the
whole page live — palette, typography and shape — across six preview themes: **Studio**
(the default), **Terracotta**, **Noir**, **Ocean**, **Editorial**, **Mono**. The choice is
saved to `localStorage` (no cookies) and re-applied before paint. It's here so you can
audition designs quickly while making the template yours — see [`docs/themes/`](docs/themes)
for screenshots.

**You almost certainly want to remove it before a real launch.** A commercial landing page
rarely lets visitors re-skin it, and the switcher ships extra CSS plus (lazily loaded)
webfonts. Two ways to finish with it:

- **Adopt a theme as your design.** Pick the `[data-theme="…"]` block you like in
  `src/styles/themes.css` and fold its values into the `:root` tokens in
  `src/styles/tokens.css` — it overrides the same `--color-*` / `--font-*` / `--radius-*`
  roles — then remove the switcher (below). Loading those fonts becomes part of the eager
  `<link>` in `src/layouts/Base.astro`.
- **Keep the default (Studio)** and just remove the switcher.

**To remove it** — every change is a deletion:

1. `src/layouts/Base.astro` — delete the `import ThemeSwitcher …`, the `<ThemeSwitcher />`
   mount, and the inline `<script is:inline>` theme block in `<head>`.
2. Delete `src/components/ThemeSwitcher.astro` and `src/styles/themes.css`.
3. `src/styles/global.css` — remove `@import "./themes.css";`.
4. `src/config.ts` — remove the `themes` array.
5. `tests/smoke.spec.ts` — remove the `theme switcher …` test.
6. *Optional:* in `src/styles/tokens.css` the semantic layer is shared by
   `:root, [data-theme="default"]`; drop the `, [data-theme="default"]` once no theme
   attribute is ever set. Delete [`docs/themes/`](docs/themes) too.

`bun run verify` then confirms nothing still references the removed files.

## Local development

`mise.toml` pins the bun runtime; everything else (Biome, Lefthook, Playwright) is a
pinned bun devDependency — so the same versions run locally and in CI, and CI needs no
mise.

```sh
mise install          # bun (the runtime)
bun install           # JS deps + tooling; installs the git hooks via lefthook
cp .env.example .env  # the ONE secrets file
bun run dev           # http://localhost:4321
```

`.env` is the single secrets file; `bun run dev` generates `.dev.vars` from it
(`@astrojs/cloudflare` reads that for the Worker's runtime bindings — you never edit it).
`src/config.ts` ships the **always-pass Turnstile test key**, so the widget works locally
out of the box; the email step needs a real `FASTMAIL_API_TOKEN` in `.env` to actually send
(otherwise the endpoint returns a friendly "not configured" message).

| Command             | Action                                          |
| :------------------ | :---------------------------------------------- |
| `bun run dev`       | Dev server (workerd) at `localhost:4321`        |
| `bun run build`     | Production build to `./dist/`                   |
| `bun run preview`   | Preview the built worker locally                |
| `bun run check`     | Type-check (`astro check`)                      |
| `bun run lint`      | Biome lint + format check                       |
| `bun run lint:fix`  | Biome auto-fix + format                         |
| `bun run e2e`       | Playwright smoke tests (set `BASE_URL`)         |

## Quality gates

**Local hooks and CI run the same commands**, so a local pass means a CI pass — there are
no CI-only checks to be surprised by. The gate is two scripts:

- **`bun run verify`** = Biome lint + `astro check` + `astro build`.
- **`bun run e2e:preview`** = upload a throwaway Workers preview (production untouched) and
  run the Playwright suite (`tests/`) against it: smoke (renders), form-submit (intercepted
  `POST /api/contact`), and **a11y** (`@axe-core/playwright`, **WCAG 2.2 AA** on `/` and
  `/thanks`). Needs Cloudflare auth (`wrangler login` locally; a token in CI).

Where they run:

- **Lefthook** (`lefthook.yml`): `pre-commit` runs Biome on staged files (auto-fix + re-stage);
  `pre-push` runs `verify` then the e2e suite. The e2e skips docs-only pushes (root `*.md`,
  `docs/**`) and when not logged in to Cloudflare. Bypass with `--no-verify` (CI still enforces it).
- **CI** (`.github/workflows/`): `ci.yml` (branches/PRs) and `deploy.yml` (main, then
  `wrangler deploy`) both run `verify` + the e2e suite. Both **skip docs-only pushes** via
  `paths-ignore`.
- **Biome** scope note: JS/TS/JSON/CSS only — `.astro` templates are excluded (partial Biome
  support); their types are covered by `astro check`.

To reproduce CI locally: `bun run verify` (static checks) and `bun run e2e:preview` (full suite).

## Where config lives

Two places, split by sensitivity:

- **Secrets → `.env`** (gitignored, the only secrets file). `bun run bootstrap` pushes the
  runtime ones to the Worker, where they persist across deploys. `.dev.vars` for local dev is
  generated from `.env`.
- **Public config → `src/config.ts`** (committed): your `DOMAIN` and the Turnstile
  **sitekey** (bootstrap fills the sitekey in; the test key is the placeholder).

| Name                   | Lives in                        | Purpose                                              |
| :--------------------- | :------------------------------ | :--------------------------------------------------- |
| `ALCHEMY_PASSWORD`     | `.env`                          | Encrypts secrets in the local `.alchemy/` state      |
| `CLOUDFLARE_API_TOKEN` | `.env` (+ CI secret)            | Cloudflare deploy/provision credential               |
| `CLOUDFLARE_ACCOUNT_ID`| `.env` (+ CI secret)            | Cloudflare account                                   |
| `FASTMAIL_API_TOKEN`   | `.env` → Worker secret          | Fastmail token (**Email** + **Email Submission** scopes) |
| `MAIL_FROM` / `MAIL_TO`| `.env` → Worker secret          | Send *as* / deliver leads to                         |
| `DOMAIN`               | `src/config.ts`                 | Apex domain (canonical URL, allowlist, custom domain)|
| Turnstile sitekey      | `src/config.ts`                 | Public widget key (bootstrap fills it in)            |
| Turnstile secret       | created by bootstrap → Worker   | Server-side widget secret                            |

> **Using a different mail provider?** The send logic is isolated in `src/lib/fastmail.ts`
> behind a small `sendEmail()` interface. Swap that module for your provider (Resend,
> Postmark, SES, …) and the rest of the form keeps working unchanged.

## Stand it up (one command)

Everything that used to be a manual checklist — creating the Turnstile widget and its
hostname allowlist, attaching a custom domain + DNS, deploying the Worker, pushing its
secrets — is automated. Fill in **one** dotenv and run **one** command.

**Two prerequisites have no provisioning API, so you create them by hand first:**

1. A **Cloudflare** account + API token. Token scopes: *Workers Scripts:Edit*,
   *Turnstile:Edit*, *Workers Routes:Edit*, and (only if you set a custom `DOMAIN` in
   `src/config.ts`) *Zone:Read* + *DNS:Edit* on that zone. Grab your account ID from the
   dashboard sidebar.
2. A **Fastmail** account + API token with **Email** + **Email Submission** scopes
   (Settings → Privacy & Security → API tokens).

Then:

```sh
# (optional) set your apex domain in src/config.ts first
cp .env.example .env     # fill in CF token/account, Fastmail token, MAIL_FROM/TO, ALCHEMY_PASSWORD
bun run bootstrap        # add --setup-gh to also configure GitHub Actions (needs GITHUB_TOKEN)
```

`bun run bootstrap` ([`scripts/bootstrap.ts`](scripts/bootstrap.ts)) runs preflight →
**Alchemy** (creates the Turnstile widget; with `--setup-gh`, the GitHub Actions
secrets) → writes the sitekey into `src/config.ts` → `astro build` → `wrangler deploy` →
pushes the Worker's runtime secrets → attaches the custom domain (+ DNS) when its zone is
in your account. Every step is idempotent, so it's safe to re-run.

It writes the real Turnstile **sitekey** into `src/config.ts` — commit that so future
builds (local and CI) inline it.

> **What Alchemy owns vs. wrangler.** Alchemy (TypeScript IaC, `alchemy.run.ts` +
> [`alchemy/turnstile.ts`](alchemy/turnstile.ts)) *provisions* the Turnstile widget and
> CI secrets; wrangler *ships* the Worker. State lives in `.alchemy/` (gitignored; secrets
> encrypted with `ALCHEMY_PASSWORD`) — kept on your machine for idempotent re-runs, not
> needed by CI. If you lose it, a re-bootstrap creates a fresh widget and rewrites the
> sitekey into `config.ts` + the secret onto the Worker, so everything stays consistent —
> it just leaves the old widget orphaned in the dashboard.

### Just want a preview URL? (no domain, no Fastmail yet)

To put it on a `*.workers.dev` URL without setting up Turnstile, Fastmail, or a domain,
skip bootstrap and deploy directly:

```sh
# .env needs only the two Cloudflare credentials
bun run deploy   # = astro build + wrangler deploy
```

You get `https://astro-landing-template.<your-subdomain>.workers.dev`. The page renders
fully; the contact form shows the widget (the committed **always-pass test sitekey**) and
the server skips the spam check (no secret set). Submissions just won't email until you add
Fastmail — fine for a demo.

To get a **working** form on the preview instead, run the full `bun run bootstrap` with
`DOMAIN` left as the `acme.example` placeholder in `src/config.ts`: it auto-skips the custom
domain and allowlists the Turnstile widget for your `*.workers.dev` host. (One caveat either
way: the canonical/OG URL reads `site.url` from `config.ts`, so it shows `acme.example` until
you set `DOMAIN` — harmless for a throwaway preview.)

## Deploy (push to `main` ships content)

After the first bootstrap, `.github/workflows/deploy.yml` runs on every push to `main`
(and via the Actions tab → *Run workflow*): `verify` → e2e preview → `wrangler deploy`.
It ships **content only** — the Worker's secrets and custom domain were provisioned by
bootstrap and **persist across deploys** (wrangler never deletes a secret or detaches a
domain). So editing copy in `src/config.ts` and pushing just works.

CI needs just **two** repo secrets (Settings → Secrets and variables → Actions) — the
Cloudflare credentials — or run `bun run bootstrap --setup-gh` once to set them for you.
Everything else is either committed (`src/config.ts`) or already on the Worker.

| Secret                  | Value                          |
| :---------------------- | :----------------------------- |
| `CLOUDFLARE_API_TOKEN`  | the Cloudflare token from above|
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account ID     |

Rotate a runtime secret (Fastmail token, etc.) by updating `.env` and re-running
`bun run bootstrap` (or `wrangler secret put`) — CI doesn't touch them.

### Deploy from your machine (alternative)

```sh
bun run deploy           # = astro build + wrangler deploy
bun run destroy          # full teardown: Alchemy resources (Turnstile, CI secrets) + the Worker
```

## Before launch — replace placeholders

Everything in `src/config.ts` (name, tagline, email/phone, service area, ABN, services,
claims) and the inline copy in `src/components/` is placeholder text. The `Photo`
placeholder frames stand in for real photography. Replace all of it before going live.

Also decide what to do with the **theme switcher** — adopt one theme as your design or keep
the default, then remove the switcher. See [Theme switcher](#theme-switcher-a-preview-tool--decide-before-launch).
