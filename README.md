# Bhumi Indica — Customer Feedback

Anonymous 2-question feedback form + admin dashboard.
React + Vite frontend, Supabase backend, deployed free on GitHub Pages.

- Form: `/#/`  ·  Admin: `/#/admin`
- Questions live in **`src/config/questions.js`** — the only file to edit to change them.

## Setup (one time, ~10 minutes)

### 1. Supabase
1. Supabase → your project → **SQL Editor** → New query → paste `supabase/schema.sql` → **Run**.
2. Add the admin email (same SQL editor):
   ```sql
   insert into public.admin_emails (email) values ('client@email.com');
   ```
3. **Authentication → Users → Add user → Create new user**: same email + a password, tick *Auto confirm*.
4. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (only you create admins).
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. GitHub
1. Push this folder to a new repo (branch `main`).
2. Repo → **Settings → Secrets and variables → Actions** → add:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
3. Repo → **Settings → Pages** → Source: **GitHub Actions**.
4. Push (or run the *Deploy to GitHub Pages* workflow). Site goes live at `https://<user>.github.io/<repo>/`.

The *Keep Supabase awake* workflow pings the database every 3 days so the free project never pauses.

### 3. Custom domain later (feedback.bhumiindica.in)
- DNS (Hostinger/registrar): **CNAME** `feedback` → `<user>.github.io`
- Repo → Settings → Pages → Custom domain: `feedback.bhumiindica.in` → tick *Enforce HTTPS*.
- Or move to Hostinger: run `npm run build` and upload the `dist/` folder to the subdomain's folder. Works as-is (relative paths + hash routes).

## Local dev
```bash
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

## Spam protection
- No direct table access for the public — submissions only go through the `submit_feedback` function.
- Hidden honeypot field, minimum 3-second fill time, size limits, max 5 submissions per IP per hour (IP stored only as a hash).
- No names, emails or phone numbers are collected.
