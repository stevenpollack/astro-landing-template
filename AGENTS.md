# Working in this repo

A reusable **commercial landing page** template — a static Astro 7 + TypeScript site on
Cloudflare Workers, with a contact form that emails leads via the Fastmail JMAP API. All
copy is lorem-ipsum placeholder; see `README.md` for the full picture and how to make it
yours. This file is the short "how to work here".

## Toolchain & setup

`mise.toml` pins **bun** (the runtime); everything else (Biome, Lefthook, Playwright) is
a pinned **bun devDependency**, so versions match locally and in CI without mise in CI.

```sh
mise install      # bun
bun install       # JS deps + tooling; also installs git hooks (lefthook) via `prepare`
bun run dev       # dev server at http://localhost:4321 (workerd via the cloudflare vite plugin)
```

`bun run dev` runs the server in the background; manage it with `astro dev stop|status|logs`.

## Commands

| Command            | Action                                              |
| :----------------- | :-------------------------------------------------- |
| `bun run dev`      | Dev server                                          |
| `bun run build`    | Production build to `./dist/`                        |
| `bun run check`    | Type-check (`astro check`)                          |
| `bun run lint`     | Biome lint + format check (`lint:fix` to auto-fix)  |
| `bun run e2e`      | Playwright smoke tests (set `BASE_URL`)             |

## Conventions

- **Design tokens are the single source of truth.** Restyle by editing CSS variables in
  `src/styles/tokens.css`; components must never hard-code colours/fonts/spacing.
- **Copy lives in `src/config.ts`** (services, contact details, nav). Don't scatter it.
- **Biome** formats/lints JS/TS/JSON/CSS. `.astro` files are intentionally **out of Biome's
  scope** (partial support); their types are covered by `astro check`. Match existing style.
- Keep changes KISS/DRY/YAGNI.

## Architecture gotchas (don't relearn these the hard way)

- **`nodejs_compat` is required** (`wrangler.jsonc`). Without it every route 500s in dev with
  "process is not defined" (Astro's logger touches `process` in workerd).
- **Env is read via `import { env } from "cloudflare:workers"`** in `src/pages/api/contact.ts`,
  not `Astro.locals.runtime`. Secret types are augmented on `Cloudflare.Env` in `src/env.d.ts`.
- **Contact form** → `src/pages/api/contact.ts` (`export const prerender = false`) → validate →
  honeypot → Turnstile → `src/lib/fastmail.ts` (JMAP). Mail sends *as* `MAIL_FROM` with the
  visitor in `Reply-To`.
- **Turnstile enforces a hostname allowlist.** Any host serving the form (apex, www, and each
  `*.workers.dev` preview) must be added in the Turnstile dashboard, or the widget fails with
  error 110200 and issues no token. Headless browsers can't solve a real challenge, so the
  submit test **intercepts** the request (`page.route`) — it asserts the client POSTs the right
  payload without hitting the server (no real email) and without depending on Turnstile. Don't
  try to spoof/defeat Turnstile in tests; use Cloudflare's always-pass test keys if the server
  path ever needs exercising.

## Quality gates — local and CI run the SAME commands

The gate is two scripts, invoked identically by the git hooks and by CI, so a local pass
means a CI pass (no CI-only checks). **Don't add a check to CI without adding it to the
hooks, or vice versa** — keep them mirrored.

- **`bun run verify`** = Biome lint + `astro check` + `astro build`.
- **`bun run e2e:preview`** = upload a throwaway Workers preview (production untouched) and
  run the Playwright suite (`tests/`): smoke (pages render), submit (asserts the intercepted
  `POST /api/contact`), and **a11y** (`@axe-core/playwright`, **WCAG 2.2 AA** on `/` and
  `/thanks`, zero violations; Turnstile excluded, benign axe `incomplete` items not asserted).
  Skips on docs-only pushes, when not logged in to Cloudflare, or with `SKIP_PREVIEW_E2E=1`.

Where they run:

- **Lefthook** (`lefthook.yml`): `pre-commit` = Biome on staged files; `pre-push` = `verify`
  then the e2e suite. `--no-verify` bypasses locally, but **CI still enforces the same gate**.
- **CI** (`.github/workflows/`): `ci.yml` (branches/PRs) and `deploy.yml` (main) both run
  `verify` + the e2e suite; both skip docs-only pushes via `paths-ignore`.

To reproduce CI locally: `bun run verify` and `bun run e2e:preview`.

## Deploy

Push to `main` → Deploy workflow runs `verify` + the e2e suite, then `wrangler deploy`s to
Cloudflare Workers and syncs runtime secrets/vars to the Worker. Secrets/vars live in the
repo's Actions settings (see `README.md`). Docs-only pushes don't deploy.

## Before "real" launch

Content in `src/config.ts` (services, email/phone, ABN, claims), the inline copy in
`src/components/`, and the `Photo` placeholder frames are lorem-ipsum drafts — replace
them with real content and photography before launch.
