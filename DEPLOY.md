# Deploying DaybyDay

Three hosted pieces, all free-tier:

| Piece | Host | Notes |
|-------|------|-------|
| Database + Auth | Supabase | already live (`wclfupgqlrtxptmhggbm`) |
| API (Fastify) | Railway | builds from the root `Dockerfile` |
| Web app (Expo web) | Vercel | builds from `vercel.json` |

Deploy the **API first** (Vercel needs its URL).

---

## 1. API → Railway

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → pick `Bartoses/daybyday`.
2. Railway detects the root `Dockerfile` automatically. (If it asks, builder = Dockerfile.)
3. Open the service → **Variables** → add:
   - `SUPABASE_URL` = `https://wclfupgqlrtxptmhggbm.supabase.co`
   - `SUPABASE_ANON_KEY` = (the anon key from `.env`)
   - `SUPABASE_SERVICE_ROLE_KEY` = (the service-role key from `.env`)
   - `TWILIO_VALIDATE` = `false`  (SMS leg not used yet)
   - `PORT` is injected by Railway automatically — don't set it.
4. **Settings → Networking → Generate Domain.** Copy the URL
   (e.g. `https://daybyday-production.up.railway.app`).
5. Check `https://<that-url>/health` returns `{"status":"ok",...}`.

---

## 2. Web app → Vercel

1. Vercel → **Add New → Project** → import `Bartoses/daybyday`.
2. **Root Directory: leave as the repo root** (`./`). The root `vercel.json` sets the
   build command (`pnpm --filter @daybyday/mobile build`) and output (`apps/mobile/dist`).
3. **Environment Variables** → add (all three):
   - `EXPO_PUBLIC_SUPABASE_URL` = `https://wclfupgqlrtxptmhggbm.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (the anon key)
   - `EXPO_PUBLIC_API_URL` = the Railway URL from step 1.4 (no trailing slash)
4. **Deploy.** Vercel gives you a `*.vercel.app` URL — that's your live app.

> Changing `EXPO_PUBLIC_*` later requires a **redeploy** (they're baked in at build time).

---

## 3. Supabase auth settings

- **Authentication → Providers → Email**: for the smoothest signup, turn **Confirm email**
  off (re-enable with a real email template before public launch).
- **Authentication → URL Configuration → Site URL**: set to your Vercel URL once you have it
  (used for confirmation/reset links).

---

## Updating

Push to `master` → Railway and Vercel both auto-redeploy. To re-import content, re-run the
importer locally (stable `id`-based tip_ids update in place).
