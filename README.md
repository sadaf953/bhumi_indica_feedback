# Bhumi Indica — Customer Feedback

Post-purchase feedback (customer name + phone or email → Q1 first cast iron purchase? → if No, Q2 current brand) + admin dashboard.
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
- Collects the customer's name and one contact (Indian mobile or email), validated on the page and in the database. Only admins (emails in admin_emails) can read them; the public cannot read the table at all.

## Keep-alive and daily backup (GitHub Actions)
Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | anon public key (keep-alive) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (backup only; never put it in the website) |
| `BACKUP_REPO` | e.g. `sadaf953/bhumi_feedback_backup`, a **private** empty repo |
| `BACKUP_PAT` | fine-grained GitHub token with Contents: read & write on that backup repo only |
| `SUPABASE_DB_URL` | optional: full Postgres connection string for a complete dump |
| `ALERT_WEBHOOK_URL` | optional: Slack/Discord webhook for failure alerts |

- **keep-alive.yml** pings `rpc/ping` daily so the free project never pauses.
- **daily-backup.yml** runs at 1:30 AM IST, saves `responses`, `admin_emails` and login accounts as CSV into the backup repo, one folder per run. Test both from the Actions tab → Run workflow.

## Admin passwords
- **Change password**: link at the top of the dashboard (min 8 characters).
- **Forgot password?**: on the sign-in page; emails a reset link (Supabase's built-in email, no edge function). Requires Supabase → Authentication → URL Configuration: Site URL `https://feedback.bhumiindica.in/admin/` and the same in Redirect URLs.
