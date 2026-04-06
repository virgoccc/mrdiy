# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # install dependencies
cp .env.local.example .env.local  # set up env (fill in Supabase keys)
npm run dev                # start dev server at http://localhost:3000
npm run build              # production build
npm run lint               # ESLint via next lint
```

No test suite is configured.

## Architecture

**Stack:** Next.js 14 (App Router) + Supabase (auth + database) + Tailwind CSS. Deployed to Vercel.

**Auth model:** Supabase Auth is the identity layer, but the app maintains its own `app_users` table linked to `auth.users` via UUID. Email addresses are synthetic (`username@mrdiy.internal`) — users log in by username/password, not real email. The three roles are `master`, `team`, and `client`.

**Supabase clients — two patterns:**
- `lib/supabase.ts` → `createClient()` — browser client (used in client components)
- `lib/supabase-server.ts` → `createServerSupabase()` — server client with cookie access (used in server components and API routes)
- API routes that need admin privileges (create/delete users) use `SUPABASE_SERVICE_ROLE_KEY` directly via `createServerClient` — this key must never be used in client-side code

**User context:** `components/UserContext.tsx` provides a `UserProvider` and `useUser()` hook that wraps the current `AppUser` (from `app_users`) for all client components. It is mounted in `app/dashboard/layout.tsx`.

**Data model (key tables):**
- `app_users` — user profiles with roles, linked to `auth.users`
- `jobs` — campaign jobs with `services` (jsonb: `flyer`, `posm`, `bunting`) and `tl_stages` (jsonb tracking per-service stage 0–3)
- `share_tokens` — passwordless read-only client view links (`/share/[token]`)
- `telegram_config` — single-row table for bot token + chat ID
- `reminder_log` — tracks sent reminders per job

**Routing:**
- `/auth` — login page
- `/dashboard` — job board (main view, role-gated editing)
- `/dashboard/overview` — analytics/summary view
- `/dashboard/reminders` — reminder log
- `/dashboard/settings` — user management, Telegram config, share link management
- `/share/[token]` — public read-only job board (no auth required)
- `/api/users/create|update|delete` — user CRUD (master-only, use service role key)

**Types:** All shared types and constants live in `types/index.ts` — `Job`, `AppUser`, `ServiceKey`, `SVC_META`, `TL_STAGES`, `TL_FINAL`, `MALAYSIAN_STATES`.

**Required env vars:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
