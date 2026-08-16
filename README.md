# Orbit

A browser-based collaborative development environment: open a project, edit HTML/CSS/JS with Monaco, see a live sandboxed preview, and collaborate with others in real time — no local setup required.

## Features

- **Dashboard** — search, favorite, and filter your projects ("All" / "Shared with me" / "Favorites"), create from a blank or landing-page template, delete with confirmation.
- **Editor** — Monaco-powered file editor with a resizable file tree, tabbed files, find-in-file, project-wide search, go-to-line, and a command palette (⌘K) for every action.
- **Live preview** — HTML/CSS/JS files are bundled into a sandboxed `<iframe>` and re-run on save (or on demand), with console/problems/output panels wired to real `console.*` calls and runtime errors from the preview.
- **Real-time collaboration** — multiple people editing the same file see each other's cursors, selections, and live edits via a CRDT (Yjs), with connection-state indicators and presence.
- **Sharing** — invite collaborators as Owner/Editor/Viewer, or generate a share link with a chosen permission level; every mutating action re-checks the caller's role server-side.
- **Version history** — save named checkpoints, diff any two versions per file, and restore non-destructively (a restore is recorded as a new version, so history only ever grows forward).
- **Settings** — editor behavior (font size, tab size, word wrap, minimap, line numbers, autosave), appearance, collaboration (cursor visibility), and a documented list of every keyboard shortcut — all backed by real, working controls, persisted across sessions.
- **Auth** — passwordless sign-in via emailed magic link or a typed one-time code, no passwords stored.

## Architecture

```
                         Vercel
                           |
                        Next.js
                           |
             +-------------+--------------+
             |              |              |
             v              v              v
        Supabase        Supabase       Supabase
        Postgres          Auth         Realtime
             |
           Prisma
             |
      Application data
```

- **Next.js (App Router)** serves the marketing site, auth flow, dashboard, and editor, and hosts all API routes.
- **Supabase Postgres + Prisma** stores projects, files, membership/roles, share links, and version snapshots.
- **Supabase Auth** handles sign-in (email magic link and one-time code) and session cookies.
- **Supabase Realtime** carries live collaboration traffic (Yjs updates, cursor/selection awareness, and presence) over Broadcast/Presence channels — there is no custom WebSocket server.
- **Yjs** owns collaborative document state (CRDT). Redux never holds live document text.

This stack is deliberately chosen so the app deploys as Vercel + Supabase only, with no always-on custom backend process.

### Realtime collaboration, without a custom server

Each open file gets one Supabase Realtime channel. Local Yjs updates are broadcast to that channel and applied by peers via `Y.applyUpdate` (CRDT merges are commutative, so no message ordering guarantees are needed). Cursor/selection state is throttled and sent as awareness updates on the same channel; coarse online/offline presence uses Supabase's own Presence feature. Document state is periodically compacted and flushed to Postgres (`File.content` + `File.yjsState`) on an idle debounce — never per keystroke. New clients bootstrap from `y-indexeddb` (instant local cache) then the latest Postgres snapshot, then catch up on anything since via a short peer-to-peer sync handshake over the same channel — the same handshake runs again after a reconnect, so a dropped connection never loses local edits.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS v4 |
| Client state | Redux Toolkit + React Redux |
| Code editor | Monaco Editor |
| Collaboration CRDT | Yjs (`y-monaco`, `y-indexeddb`, `y-protocols/awareness`) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | Supabase Auth (email magic link + one-time code) |
| Realtime transport | Supabase Realtime (Broadcast + Presence) |
| Unit/integration testing | Vitest |
| End-to-end testing | Playwright |
| Deployment | Vercel |

## Local setup

```bash
npm install
cp .env.example .env   # fill in Supabase values, see below
npx prisma generate
npx prisma migrate dev
npm run dev
```

`.env` (not `.env.local`) is used deliberately: the Prisma CLI only auto-loads `.env`, and Next.js reads it too, so one gitignored file covers both.

### Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **Settings → API**: copy the Project URL and `anon public` key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY` (server-only — never sent to the browser).
3. **Settings → Database**: copy the pooled connection string (port 6543, "Transaction" mode) into `DATABASE_URL`, and the direct connection string (port 5432) into `DIRECT_URL`.
4. **Authentication → URL Configuration**: set the Site URL to `http://localhost:3000` in development (and your deployed URL, e.g. `https://your-app.vercel.app`, in production), and add both as redirect URLs — the magic-link/OTP email links back through `NEXT_PUBLIC_APP_URL`, so it must match whatever the app is actually served from in each environment.
5. **Authentication → Email Templates**: replace the default "Magic Link" and "Confirm signup" templates with `supabase/email-templates/magic-link.html` and `supabase/email-templates/confirm-signup.html`. Both templates are needed — `signInWithOtp()` routes new/unconfirmed emails through "Confirm signup" and returning users through "Magic Link". Supabase email templates are project-level dashboard configuration with no source of truth in application code, so this step must be repeated on every new Supabase project (including a disaster-recovery recreation).

### Environment variables

See `.env.example` for the full list. Anything prefixed `NEXT_PUBLIC_` is exposed to the browser; everything else (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) is server-only and must never be imported from client code.

`DATABASE_URL` and `DIRECT_URL` must both carry `connection_limit=5&pool_timeout=15` — see "Connection pooling" below for why these exact values are locked.

### Database migrations

```bash
npx prisma migrate dev --name <description>   # local development
npx prisma migrate deploy                       # CI/production
```

Prisma uses `DIRECT_URL` (unpooled) for migrations and `DATABASE_URL` (Supavisor-pooled) for runtime queries — see `prisma/schema.prisma`. `npm install` runs `prisma generate` automatically via a `postinstall` script, so this doesn't need a separate manual step — including on Vercel, where the platform runs `npm install` before `npm run build`.

Migrations are the only source of truth for schema, RLS, and Realtime Authorization — a fresh Supabase project needs nothing beyond `npx prisma migrate deploy` to reach the same state as production. A few are worth calling out specifically since they're easy to assume are dashboard-only configuration:
- `20260812163153_enable_rls` enables Postgres RLS on every application table (`profiles`, `projects`, `project_members`, `files`, `project_versions`, `version_file_snapshots`, `share_links`) with **zero policies**. This is intentional: Prisma's `DATABASE_URL`/`DIRECT_URL` connections go straight to Postgres and are unaffected by RLS, but it means the public `anon` key can never read or write these tables through Supabase's auto-exposed PostgREST API — all authorization instead happens in application code (every mutating API route re-checks role server-side).
- `20260813092633_realtime_authorization` and `20260813094843_realtime_authorization_project_presence` set up Realtime Authorization (private-channel RLS on `realtime.messages`, via a `SECURITY DEFINER` function) so only users with actual project access can subscribe to a project's or file's live-collaboration channel. On a freshly-provisioned Supabase project, the very first channel subscribe attempt right after migrating can transiently `CHANNEL_ERROR` even for an authorized user — this is Realtime's tenant eventual-consistency picking up the new policies, not a bug; it resolves within seconds.
- `20260814143404_fix_rls_gaps` and `20260814143520_revoke_anon_realtime_auth_fn` close two gaps found after the fact (RLS missing on `project_favorites`/`_prisma_migrations`, and PUBLIC/anon `EXECUTE` left grantable on the Realtime authorization function). New tables or `SECURITY DEFINER` functions should be checked against Supabase's Security Advisor after every schema change — RLS coverage doesn't extend to new objects automatically.

### Connection pooling

Orbit's runtime database access is locked to: **Supavisor transaction-mode pooling** (`DATABASE_URL`, port 6543, `pgbouncer=true`), `connection_limit=5`, `pool_timeout=15`. This was benchmarked, not guessed — session-mode pooling (port 5432, prepared statements) is 2.5–6x faster per query but hits a hard, non-queueing 15-connection project-wide Supavisor cap under realistic multi-instance serverless load, whereas transaction mode degrades gracefully via Prisma's own `pool_timeout`. Do not switch to session mode for general runtime traffic without re-running the benchmark scripts (`scripts/ab-trace-benchmark.mjs`, `scripts/ab-http-benchmark.mjs`) and re-confirming the Supavisor cap hasn't changed.

## Testing

```bash
npm run test
```

Vitest covers permission checks, file-path handling, and other logic that's cheap to get wrong and expensive to get wrong silently — not UI snapshots.

### End-to-end

```bash
node --env-file=.env scripts/e2e-full-flow.mjs
```

A full Playwright suite that drives a real browser through the entire product — signup, dashboard, file CRUD, Monaco editing, live preview, sharing/permissions, real-time sync between two sessions, disconnect/reconnect, version history, and share-link lifecycle. It runs against whatever `DATABASE_URL`/Supabase project is in `.env`, so point it at a disposable/dev project, not production.

Every test user and project it creates is prefixed so it can be cleaned up afterward — always run this when a suite is interrupted (`Ctrl+C`, a crash) or after any manual E2E script, since interrupted runs skip their own cleanup:

```bash
node --env-file=.env scripts/cleanup-e2e-leftovers.mjs
```

The suite never sends real email — it uses the Supabase Admin API (`generateLink`/`createUser`) to establish sessions directly, with one deliberately network-intercepted exception to still exercise the typed-OTP UI path without a real send.

## Deployment

Target: **Vercel + Supabase**, no other infrastructure — no always-on custom server to deploy or operate. Orbit's production Supabase project runs in **Mumbai (`ap-south-1`)**, chosen after benchmarking it against the original Sydney (`ap-southeast-2`) region and measuring a ~79% average latency reduction for an India-based user base (see `scripts/region-benchmark.mjs` if this ever needs re-validating for a different primary user base or region).

1. **Supabase project**: follow "Supabase project" above against a real (not free-tier-throwaway) project. Run `npx prisma migrate deploy` against it — this alone brings schema, RLS, and Realtime Authorization to production-ready state.
2. **Vercel project**: connect the Git repository. Framework preset: Next.js (auto-detected). No custom build command is required — `npm install` (which also runs `prisma generate`) followed by `npm run build` is Vercel's default and is sufficient.
3. **Environment variables**: set every variable from `.env.example` in the Vercel project's Environment Variables settings, scoped to Production (and Preview/Development if those environments point at their own Supabase projects). Use the real Mumbai project's values — `DATABASE_URL`/`DIRECT_URL` must keep `connection_limit=5&pool_timeout=15` (see "Connection pooling" above).
4. **`NEXT_PUBLIC_APP_URL`**: set to the real production URL (e.g. `https://orbit.vercel.app` or a custom domain) — this is what magic-link/OTP emails link back to.
5. **Supabase Auth → URL Configuration**: set Site URL and add a redirect URL for the production `NEXT_PUBLIC_APP_URL`, same as the local setup step but for the deployed domain.
6. **Supabase Auth → Email Templates**: paste in `supabase/email-templates/magic-link.html` and `confirm-signup.html` (dashboard-only config, not deployed by Vercel).
7. Push/deploy. There is no separate realtime server, worker, or cron process to stand up — Supabase Realtime, Auth, and Postgres are all fully managed.

After deploying, re-run the real-Orbit-operation benchmarks (the same ones used for the Sydney→Mumbai comparison) against the live production URL and compare against the Mumbai local-dev baseline before treating any latency numbers as representative of production — local dev and a Vercel edge/region deployment do not necessarily have identical network paths to Supabase.

## Security considerations

- Every mutating API route re-verifies project membership/role server-side; the client's cached role (in Redux) is for UI only and is never trusted.
- The live preview runs in a sandboxed iframe (`sandbox="allow-scripts allow-modals"`, deliberately without `allow-same-origin`) so user-authored code can never reach the parent app's session or cookies.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `DIRECT_URL` are server-only environment variables and are never referenced from client-bundled code.
- Share links use a random, unguessable token and are validated (and checked for expiry/revocation) server-side on every access.