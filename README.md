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

## Project layout

```
src/
├── config.ts              # All copy & business details (edit content here)
├── layouts/Base.astro     # HTML shell, <head>, fonts
├── styles/
│   ├── tokens.css         # DESIGN TOKENS — single source of truth (re-skin here)
│   └── global.css         # base element styles + shared .btn/.eyebrow/etc.
├── components/            # Header, Hero, Services, About, WhyUs, ContactForm, Footer, Photo
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
3. **Identifiers** — the project name is `astro-landing-template` in `package.json` and
   `wrangler.jsonc`, and `site:` in `astro.config.mjs` points at `https://acme.example`.
   Update all three to your own name/domain.
4. **Favicons** — swap the files in `public/` for your own.

## Local development

`mise.toml` pins the bun runtime; everything else (Biome, Lefthook, Playwright) is a
pinned bun devDependency — so the same versions run locally and in CI, and CI needs no
mise.

```sh
mise install                     # bun (the runtime)
bun install                      # JS deps + tooling; installs the git hooks via lefthook
cp .dev.vars.example .dev.vars   # server secrets (Fastmail token, Turnstile secret)
cp .env.example .env             # PUBLIC_TURNSTILE_SITE_KEY (client widget)
bun run dev                      # http://localhost:4321
```

The example env files ship with Cloudflare's **always-pass Turnstile test keys**, so
the form works locally out of the box. The email step needs a real
`FASTMAIL_API_TOKEN` to actually send (otherwise the endpoint returns a friendly
"not configured" message).

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
  `wrangler deploy` + secret sync) both run `verify` + the e2e suite. Both **skip docs-only
  pushes** via `paths-ignore`.
- **Biome** scope note: JS/TS/JSON/CSS only — `.astro` templates are excluded (partial Biome
  support); their types are covered by `astro check`.

To reproduce CI locally: `bun run verify` (static checks) and `bun run e2e:preview` (full suite).

## Environment variables

| Name                        | Where        | Purpose                                              |
| :-------------------------- | :----------- | :--------------------------------------------------- |
| `FASTMAIL_API_TOKEN`        | secret       | Fastmail token with **Email** + **Email Submission** scopes |
| `MAIL_FROM`                 | var/secret   | Verified Fastmail address to send *as*               |
| `MAIL_TO`                   | var/secret   | Where leads are delivered                            |
| `TURNSTILE_SECRET_KEY`      | secret       | Turnstile server key (omit to disable the spam check)|
| `PUBLIC_TURNSTILE_SITE_KEY` | `.env` (build)| Turnstile site key for the widget (safe to expose)  |

> **Using a different mail provider?** The send logic is isolated in `src/lib/fastmail.ts`
> behind a small `sendEmail()` interface. Swap that module for your provider (Resend,
> Postmark, SES, …) and the rest of the form keeps working unchanged.

## Deploy (GitHub Actions → Cloudflare Workers)

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (and via
the Actions tab → *Run workflow*). It uses `wrangler deploy`, which follows
`.wrangler/deploy/config.json` → `dist/server/wrangler.json` (serves only
`dist/client`).

**One-time GitHub setup** (repo → Settings → Secrets and variables → Actions). All
config is a single source of truth here; the workflow pushes the runtime secrets to
the Worker on every deploy.

| Kind     | Name                        | Value                                                       |
| :------- | :-------------------------- | :---------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`      | API token from the **"Edit Cloudflare Workers"** template   |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare account ID (dashboard sidebar)                   |
| Secret   | `FASTMAIL_API_TOKEN`        | Fastmail token — **Email** + **Email Submission** scopes    |
| Secret   | `TURNSTILE_SECRET_KEY`      | Turnstile **secret** key                                    |
| Variable | `MAIL_FROM`                 | Verified Fastmail address to send *as*                      |
| Variable | `MAIL_TO`                   | Where leads are delivered                                   |
| Variable | `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile **site** key (public; used at build time)         |

The deploy job runs `wrangler deploy` then syncs the runtime config — the two
credentials (secrets) and the two mail addresses (variables) — to the Worker via
`wrangler secret put`. Update any of them in GitHub and the next deploy applies it —
no manual step. Then attach your custom domain to the Worker (dashboard → the Worker →
Domains & Routes) once DNS is on Cloudflare.

> On the very first run the deploy creates the Worker, then the secret-sync step
> populates it — so the form is configured by the end of the first successful deploy.

### Manual deploy (alternative)

```sh
bun run build && bunx wrangler deploy
```

## Before launch — replace placeholders

Everything in `src/config.ts` (name, tagline, email/phone, service area, ABN, services,
claims) and the inline copy in `src/components/` is placeholder text. The `Photo`
placeholder frames stand in for real photography. Replace all of it before going live.
