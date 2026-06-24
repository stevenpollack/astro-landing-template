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

| Command             | Action                                                       |
| :------------------ | :----------------------------------------------------------- |
| `bun run dev`       | Dev server                                                   |
| `bun run build`     | Production build to `./dist/`                                 |
| `bun run check`     | Type-check (`astro check`)                                   |
| `bun run lint`      | Biome lint + format check (`lint:fix` to auto-fix)           |
| `bun run e2e`       | Playwright smoke tests (set `BASE_URL`)                      |
| `bun run bootstrap` | One-command standup: Alchemy (Turnstile + CI secrets) + build + deploy + secrets + domain (`--setup-gh` to also configure GitHub Actions) |
| `bun run deploy`    | `astro build` + `wrangler deploy` (content-only, from your machine) |
| `bun run destroy`   | `alchemy destroy` — tear down Alchemy-managed resources       |

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
- **Turnstile enforces a hostname allowlist.** Any host serving the form (apex, www, and the
  worker's `*.workers.dev` host) must be on the widget's allowlist, or it fails with error
  110200 and issues no token. The `TurnstileWidget` resource (`alchemy/turnstile.ts`) sets this
  allowlist when bootstrap creates the widget — no dashboard clicks. Headless browsers can't
  solve a real challenge, so the submit test **intercepts** the request (`page.route`) — it
  asserts the client POSTs the right payload without hitting the server (no real email) and
  without depending on Turnstile. Don't try to spoof/defeat Turnstile in tests; use Cloudflare's
  always-pass test keys if the server path ever needs exercising.

## Infrastructure (Alchemy IaC) — provisions; wrangler ships

- **`alchemy.run.ts` + `alchemy/turnstile.ts`** are the IaC. Alchemy (TypeScript-native IaC)
  *provisions* the Turnstile widget (a custom resource hitting the CF challenges API) and, with
  `--setup-gh`, the GitHub Actions secrets. It does **not** build or deploy the Worker — wrangler
  still does that, unchanged. The split keeps wrangler's proven deploy path intact.
- **`scripts/bootstrap.ts`** sequences the ordering-dependent steps: preflight → `alchemy deploy`
  (Turnstile, writing keys to gitignored `.turnstile.json`) → write the public sitekey into
  `src/config.ts` → `astro build` → `wrangler deploy` → push Worker secrets → attach custom domain
  (+ auto DNS) when the zone exists. **Config split:** secrets live only in `.env` (`.dev.vars` is
  generated from it by `bun run dev`); public values (domain + sitekey) live only in `src/config.ts`.
- **State is local** in `.alchemy/` (gitignored; secrets encrypted via `ALCHEMY_PASSWORD`), kept
  on your machine for idempotent re-runs. **CI never runs Alchemy** — it only `wrangler deploy`s,
  so there's no shared-state requirement. Losing the state self-heals: a re-bootstrap rewrites the
  sitekey into `config.ts` + the secret onto the Worker (the old widget is just orphaned).
- **Bun is pinned to 1.3.13** (`mise.toml`): bun **1.3.14 segfaults** running the Alchemy program
  (`bun run bootstrap`/`destroy`), so don't bump to 1.3.14 until Bun fixes it. CI pins the same.
- **Worker secrets + custom domain persist across `wrangler deploy`** (Cloudflare never deletes a
  secret or detaches a domain on deploy), which is *why* push-to-main can ship content without
  re-provisioning. Don't re-add a secret-sync step to `deploy.yml`.

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

First standup is `bun run bootstrap` from a laptop (see Infrastructure above + `README.md`).
After that, push to `main` → Deploy workflow runs `verify` + the e2e suite, then `wrangler
deploy`s to Cloudflare Workers — **content only**; secrets and the custom domain were set by
bootstrap and persist. CI needs just two repo *secrets* (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`), which `--setup-gh` provisions — the public sitekey/domain are committed
in `src/config.ts`. Docs-only pushes don't deploy.

## Before "real" launch

Content in `src/config.ts` (services, email/phone, ABN, claims), the inline copy in
`src/components/`, and the `Photo` placeholder frames are lorem-ipsum drafts — replace
them with real content and photography before launch.
