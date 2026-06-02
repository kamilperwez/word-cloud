# Deployment Guide (Vercel + Supabase)

## Prerequisites

- [Supabase](https://supabase.com) project with database scripts applied ([DATABASE.md](./DATABASE.md))
- [Vercel](https://vercel.com) account
- GitHub repository

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL from Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Server-only; used for admin create/delete |
| `ADMIN_PASSWORD` | Recommended | Passcode for admin panel (default in code: `kamilsuyash`) |

**Never** commit `.env.local` or service role keys to GitHub.

## Deploy steps

1. Push code to GitHub (sensitive paths are in `.gitignore`).
2. Import the repo in Vercel → **Add New Project**.
3. Framework preset: **Next.js** (auto-detected).
4. Add environment variables above.
5. Click **Deploy**.

No custom build command is required:

```bash
npm run build
```

## Post-deploy checklist

- [ ] Open production URL and confirm polls load
- [ ] Submit a test vote from two browsers — both should update live
- [ ] Unlock admin with your passcode and create a test poll
- [ ] Test **Maximize To Screen** in presentation mode

## Free tier capacity

Counts **one database insert per participant per poll** (your `unique (poll_id, session_id)` rule). Page refreshes, realtime reloads, and session length are **not** part of these numbers.

| Scenario | Safe plan (Supabase Free) | Hard ceiling |
|----------|---------------------------|--------------|
| Everyone votes at once (INSERT burst) | **~100** people in the same few seconds | **~200–250** before timeouts or duplicate-click races become likely on shared CPU |
| Everyone has the app open for live results | **~150** simultaneous browsers | **200** concurrent Realtime connections (Supabase Free quota) |
| Total voters over days/weeks | tens of thousands per poll | **500 MB** database (millions of small vote rows) |

**One response per user:** enforced in Postgres — a second vote for the same poll and browser session returns “already voted” (`23505`).

**This app reduces free-tier load by:** debounced realtime refresh (400 ms), coalesced reloads, narrow `select` columns, a separate small query for “already voted”, no manual refresh after submit, and one automatic retry on transient vote errors.

**Vercel Hobby:** fine for the same room sizes; the usual limit is function concurrency, not one vote per user.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| RLS policy error | Run [fix-rls SQL](./DATABASE.md#2-fix-rls-fix-rlssql) |
| Empty word cloud | Run [seed SQL](./DATABASE.md#3-seed-word-clouds-seed-wordcloudsql); hard refresh |
| No live updates | Enable Realtime replication on both tables |
| Admin cannot create polls | Add `SUPABASE_SERVICE_ROLE_KEY` on Vercel and redeploy |
