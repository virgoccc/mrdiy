# MR DIY Campaign Job Tracker
## Deployment Guide — Supabase + GitHub + Vercel + Custom Subdomain

---

## STEP 1 — Supabase Setup

1. Go to **supabase.com** → open your project (or create one: New Project)
2. Go to **SQL Editor → New Query**
3. Paste the entire contents of `supabase-schema.sql` and click **Run**
   - Creates tables: `app_users`, `jobs`, `telegram_config`, `reminder_log`, `share_tokens`
   - `jobs` includes `timeline` (bool) and `tl_stages` (jsonb) for progress tracking
   - `share_tokens` enables passwordless client share links
   - All Row Level Security policies included
4. Go to **Project Settings → API** and copy these 3 values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`
   ⚠️ Never expose the service_role key in frontend code

5. **Create the master (admin) user:**
   - Go to **Authentication → Users → Add User (Invite)**
   - Email: `admin@mrdiy.internal` | Password: choose something strong
   - Copy the UUID shown for this user
   - Go back to **SQL Editor** and run (replace the UUID):
     ```sql
     INSERT INTO public.app_users (id, name, username, role)
     VALUES ('PASTE-UUID-HERE', 'Admin', 'admin', 'master');
     ```

---

## STEP 2 — GitHub Setup

1. Create a **new private repository** on GitHub (e.g. `mrdiy-tracker`)
2. Open terminal, navigate to this project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOURUSERNAME/mrdiy-tracker.git
   git branch -M main
   git push -u origin main
   ```

---

## STEP 3 — Vercel Deployment

1. Go to **vercel.com → Add New Project → Import from GitHub** → select `mrdiy-tracker`
2. Framework preset: **Next.js** (auto-detected)
3. Under **Environment Variables**, add all 3:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role secret key |

4. Click **Deploy** — Vercel builds and goes live automatically (~2 min)

---

## STEP 4 — Custom Subdomain

1. In **Vercel → your project → Settings → Domains**
2. Click **Add** → type your subdomain e.g. `jobs.youragency.com`
3. Vercel shows you a **CNAME record** to add
4. Log in to your domain registrar (where `youragency.com` is managed)
5. Add the CNAME: `jobs` → `cname.vercel-dns.com`
6. Wait 5–15 min for DNS to propagate → subdomain is live ✅

---

## STEP 5 — Add Users From Inside the App

1. Log in at your subdomain with username `admin` and the password you set
2. Go to **Settings → Users → + Add**
3. Add team members (role: Team) and client logins (role: Client)
4. All future user management is done from the app — no Supabase needed

---

## STEP 6 — Client Share Links (Passwordless)

Clients can view the job board without logging in via a share link:

1. Go to **Settings → Client Share Links → + New Link**
2. Give it a label (e.g. "MR DIY Client View")
3. Copy the generated URL and send it to your client
4. The link opens a **read-only job board** — no login required
5. Delete the link at any time to revoke access

Share link URL format: `https://your-domain.com/share/{token}`

---

## STEP 7 — Telegram Bot (Optional)

1. Message **@BotFather** on Telegram → `/newbot` → follow steps → copy the token
2. Add the bot to your internal group
3. Message **@userinfobot** in the group to get the Chat ID (starts with -100...)
4. In the app: **Settings → Telegram → paste Token + Chat ID → Save & Test**

---

## Future Updates

Every push to GitHub auto-deploys via Vercel in ~1 minute:
```bash
git add .
git commit -m "describe your change"
git push
```

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev                         # opens at http://localhost:3000
```

---

## Role Summary

| Role | Access |
|------|--------|
| **Master** | Full access — add/edit/delete jobs, manage all users, settings, Telegram, share links |
| **Team** | View + edit jobs, mark services done, advance timeline stages, see reminders & overview |
| **Client** | Login: view Job Board only (no editing). Or use a share link for no-login access |
