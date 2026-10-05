# LaunchPad

A serverless growth-experimentation platform for one campaign: get **500 final-year engineering students** to register for NxtWave's free workshop **"Build Your First AI Project in 60 Minutes"** in 7 days on ₹2,000.

**Acquire → Register → Refer → Attend → Convert → Measure → Experiment → Scale**

| Surface | URL | What it does |
|---|---|---|
| Landing page | `/` | A/B-tested headline (sticky per visitor), the 60-minute build clock, registration in the first viewport, first-touch `utm_source` / `?ref=` attribution, live countdown, masked referral leaderboard, FAQ. |
| Referral tracker | `/me/<CODE>` | Personal invite link, WhatsApp / Telegram / LinkedIn share, calendar buttons, reward ladder, friends who joined and whether they attended, rewards earned. |
| Short link | `/r/<CODE>` | Logs the click, redirects to `/?ref=<CODE>&utm_source=referral`. |
| Growth dashboard | `/admin` | Goal progress and forecast, growth loop, funnel, channels, colleges, A/B results with z-test p-values and "Send 100% here", new experiments, referral leaderboard, fraud review queue, campus ambassadors, attendance import, reward budget and issuing, CSV exports, live campaign settings, demo data. |

## Architecture

```
Vercel ── Next.js 16 UI (App Router) + Route Handlers (serverless, stateless)
              │  Zod validation · Postgres-backed rate limits · typed errors
              ▼
          Prisma 6 ──► Neon Postgres (all state: no local files)
              │
   Registrations · Referrals · Experiments/Variants/Assignments · Events
   Workshops · Attendance · Rewards · Ambassadors · RateLimit
```

Borrowed capabilities:
- **Experimentation core**: sticky assignment, minimum sample per arm before any verdict, two-proportion z-test, promotion.
- **Operational verification**: attendance import (Zoom/Meet/Teams CSV, columns detected by name, rejoins summed), a referral only qualifies when the friend attended ≥ N minutes, rewards inside the budget, fraud flags (same network as referrer, look-alike phone, bursts) with a review queue, ambassador / college tagging.
- **Ambassador UX**: personal tracker with reward ladder and friend statuses, masked public leaderboard.
- **Robustness**: strict Zod schemas on every body, JSON-only bodies with size limits, honeypot, idempotent registration (same person → same code), 409 on conflicting email/phone, rate limits that hold across serverless instances, CSV formula-injection protection, salted IP hashes (raw IPs never stored).

## Run locally

```powershell
cd D:\Desktop\NxtWave\launchpad
npm install                    # also runs prisma generate
npm run db:push                # creates the tables in Neon (needs .env.local; see below)
npm run build
npm start                      # http://localhost:3000
```

`neon link` already wrote `DATABASE_URL` and `DATABASE_URL_UNPOOLED` into `.env.local`. Prisma's CLI reads `.env`, so `db:push` is run with Node's env-file flag:

```powershell
node --env-file=.env.local node_modules/prisma/build/index.js db push
```

Admin: open `/admin` and enter the key (`nxtwave-admin` unless `ADMIN_KEY` is set). In **Settings → Demo data** click **Load demo data** for five days of simulated traffic; every page then says the data is simulated, and **Remove demo data** deletes only those rows.

## Test every endpoint

With the server running:

```powershell
node scripts/smoke.mjs                                    # 50 checks, ends with ALL CHECKS PASSED
node --env-file=.env.local scripts/cleanup-smoke.mjs      # removes the test rows it created
```

The smoke test covers pages, config + sticky A/B, events + dedupe, registration (create, idempotent, 409, per-field 400s, grad-year, honeypot, +91 normalisation), referral redirect + tracker, admin auth, attendance import → qualification → rewards → issue/reopen, experiments (promotion refused before the sample), ambassadors, config validation, all three CSV exports, formula-injection safety and rate limiting.

## Deploy to Vercel

1. Push this folder to a GitHub repository (`.env.local` and `.neon` are git-ignored).
2. On vercel.com → **Add New → Project** → import the repository. Framework: Next.js (auto). Root directory: the repo root (or `launchpad` if you pushed the parent folder).
3. Environment variables: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (copy from `.env.local`), and `ADMIN_KEY` (a long secret).
4. Deploy. `vercel.json` pins the functions to `iad1`, next to the Neon database in us-east-2, so each query is a few milliseconds. The build runs `prisma generate` automatically.
5. Open `https://<project>.vercel.app/api/health`, then `/admin` → Settings → Load demo data for the submission link.

Or from the terminal: `npx vercel login`, then `npx vercel --prod` inside this folder, and add the same three variables with `npx vercel env add`.

## Reuse for the next campaign

Everything campaign-specific (title, tagline, dates, goal, budget, accepted graduation years, attendance threshold, reward tiers, leaderboard prizes, WhatsApp share text, agenda, FAQ) is in **Settings** and validated as a whole on save. Run the next bootcamp or hackathon by editing it; no code changes.

## Known limits

- One shared admin key, no per-user roles.
- Visitor identity is a browser id in localStorage: clearing storage counts as a new visitor (both A/B arms are affected equally).
- WhatsApp reminders are click-to-send links in a CSV, not the WhatsApp Business API.
- Fixed-sample A/B testing: no early stopping. A sequential test is the upgrade if traffic is low.
