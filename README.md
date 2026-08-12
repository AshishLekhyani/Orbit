# Orbit

A browser-based collaborative development environment: open a project, edit HTML/CSS/JS with Monaco, see a live sandboxed preview, and collaborate with others in real time — no local setup required.

> **Status:** early build. This README describes the target architecture; features are being implemented incrementally (see Roadmap below for what's actually working today).

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
- **Supabase Auth** handles sign-in (email magic link) and session cookies.
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
| Auth | Supabase Auth (email magic link) |
| Realtime transport | Supabase Realtime (Broadcast + Presence) |
| Testing | Vitest |
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
4. **Authentication → URL Configuration**: set the Site URL to `http://localhost:3000` in development (and your deployed URL in production), and add it as a redirect URL.

### Environment variables

See `.env.example` for the full list. Anything prefixed `NEXT_PUBLIC_` is exposed to the browser; everything else (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) is server-only and must never be imported from client code.

### Database migrations

```bash
npx prisma migrate dev --name <description>   # local development
npx prisma migrate deploy                       # CI/production
```

Prisma uses `DIRECT_URL` (unpooled) for migrations and `DATABASE_URL` (Supavisor-pooled) for runtime queries — see `prisma/schema.prisma`.

## Testing

```bash
npm run test
```

Vitest covers permission checks, file-path handling, and other logic that's cheap to get wrong and expensive to get wrong silently — not UI snapshots.

## Deployment

Target: **Vercel + Supabase**, no other infrastructure. Push to a connected Git repository and set the same environment variables (from `.env.example`) in the Vercel project settings. There is no separate realtime server to deploy — Supabase Realtime is managed.

## Security considerations

- Every mutating API route re-verifies project membership/role server-side; the client's cached role (in Redux) is for UI only and is never trusted.
- The live preview runs in a sandboxed iframe (`sandbox="allow-scripts allow-modals"`, deliberately without `allow-same-origin`) so user-authored code can never reach the parent app's session or cookies.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `DIRECT_URL` are server-only environment variables and are never referenced from client-bundled code.
- Share links use a random, unguessable token and are validated (and checked for expiry/revocation) server-side on every access.

## Roadmap

Tracked as phases: foundation → marketing + auth → dashboard → editor shell → live preview → real-time collaboration → sharing → version history → polish. See project history for current progress.
