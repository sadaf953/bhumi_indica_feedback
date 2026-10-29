# Bhumi Indica — Customer Feedback

Anonymous post-purchase feedback (Q1 first cast iron purchase? → if No, Q2 current brand) + admin dashboard.
React + Vite frontend, Supabase backend, deployed free on GitHub Pages.

- Form: `/`  ·  Admin: `/admin/`
- All copy, brand options and links live in **`src/content.js`**. (Brand options are also locked in the database check constraint in `supabase/schema.sql` — change both together.)

## Setup (one time, ~10 minutes)

### 1. Supabase
1. Supabase → your project → **SQL Editor** → New query → paste `supabase/schema.sql` → **Run**.
2. Add the admin email (same SQL editor):
   ```sql
   insert into public.admin_emails (email) values ('vivek@…') on conflict do nothing;
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

### 3. Custom domain (feedback.bhumiindica.in)
Only once the client's developer has added the DNS record (adding it earlier breaks the github.io test URL):
- Developer adds DNS: **CNAME** host `feedback` → `<github-username>.github.io`
- Create `public/CNAME` containing `feedback.bhumiindica.in`, push.
- Repo → Settings → Pages → Custom domain: `feedback.bhumiindica.in` → tick *Enforce HTTPS*.

Moving to Hostinger later: `npm run build`, upload `dist/` to the subdomain folder. Works as-is (relative paths, real `/admin/` page, no rewrites needed). Supabase stays the same.

## Local dev
```bash
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

## Spam protection
- No direct table access for the public — submissions only go through the `submit_response` function.
- Hidden honeypot field, minimum 3-second time on page, database check constraints (only the 5 brands, brand only when answer is No), max 5 submissions per IP per hour (IP stored only as a hash).
- No names, emails or phone numbers are collected.
