# Kingdom

A private dashboard for living according to what matters most: daily intentions and quests, weekly missions and reflection, seven life areas that level up, a personal network (relationships, conversations, commitments), and an AI coach that sees all of it.

This is V2 through Phase 2: the hosted foundation plus a read-only Google Calendar connection. Weekly planning (Phase 3), Gmail (Phase 4) and LinkedIn import (Phase 5) come next.

## How it's built, in plain English

| Piece | What it does |
| --- | --- |
| **Next.js** (`src/app`) | One project holds both the pages you see and the server code behind them, so there's no separate backend to run. |
| **Postgres** (`src/db/schema.ts`) | Stores everything. Your dashboard is one document per user (the same shape as V1). People, conversations and commitments get their own tables so they can be searched and protected separately. |
| **Google sign-in** (`src/lib/auth`) | You sign in with Google. Only emails in `ALLOWED_EMAILS` get in. Sessions are random tokens; the database only keeps a hash of each one. |
| **Coach** (`src/app/api/coach`, `src/lib/coach.ts`) | The server builds a summary of your data, labels where each fact came from, and sends it to Claude. Your API key never reaches the browser. |
| **Scoring** (`src/lib/life`) | Pure functions for XP, levels, alignment and relationship goals, covered by unit tests. |

Saves use a version number: if your phone and laptop edit at the same moment, the second save is refused and that device shows the newer version, so nothing is silently overwritten.

## Set it up (about 30 minutes, once)

Nothing here costs money except the Anthropic API, which you cap yourself.

### 1. GitHub
Create a **private** repository (for example `kingdom`) and push this code to it.

### 2. Vercel and the database
1. Sign in to [vercel.com](https://vercel.com) with GitHub, click **Add New → Project**, and import the repository. Don't deploy yet.
2. In the project, open **Storage → Create Database → Neon (Postgres)**, and connect it to the project. Vercel adds `DATABASE_URL` for you.
3. Note your app's address, e.g. `https://kingdom-yourname.vercel.app`.

### 3. Google sign-in
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project called *Kingdom*.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email. Scopes: leave the defaults (email, profile, openid). Add yourself as a test user.
3. Then click **Publish app** so it's "In production". It will stay *unverified*, which is fine for personal use: you'll see a one-time "Google hasn't verified this app" warning and click through. (Apps left in "Testing" get signed out every 7 days.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → *Web application*.
   - Authorized redirect URIs: `https://YOUR-APP.vercel.app/api/auth/google/callback` and `http://localhost:3000/api/auth/google/callback`
5. Copy the Client ID and Client secret.

### 4. Anthropic (for the coach)
At [console.anthropic.com](https://console.anthropic.com), create an API key and set a **monthly spend limit** (e.g. $10) under Billing. Daily coaching typically costs a few dollars a month.

### 5. Environment variables
In Vercel → **Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `APP_URL` | `https://YOUR-APP.vercel.app` (no trailing slash) |
| `AUTH_GOOGLE_ID` | from step 3 |
| `AUTH_GOOGLE_SECRET` | from step 3 |
| `ALLOWED_EMAILS` | your Gmail address |
| `ANTHROPIC_API_KEY` | from step 4 |

Never put these in code or send them in chat.

### 6. Deploy
Click **Deploy**. The build runs the database migrations first (`npm run vercel-build`). Open your URL, sign in with Google, and import V1:

- In V1, open **Setup → Copy backup**.
- In V2, paste it into **Import from V1**, check the preview, and confirm.

Add the site to your phone's home screen from the browser's Share menu.

### 7. Connect Google Calendar (optional)
1. In Google Cloud, search for **Google Calendar API** and click **Enable**.
2. In **Google Auth Platform → Branding**, set the home page to `https://YOUR-APP.vercel.app`, the privacy policy to `https://YOUR-APP.vercel.app/privacy`, and add `YOUR-APP.vercel.app` under authorized domains. Save.
3. **Audience → Publish app.** (Apps left in "Testing" lose calendar access every 7 days.)
4. In Kingdom, open **Setup → Connections → Connect Google Calendar** and allow read-only access.

Calendar access is separate from sign-in, read-only (`calendar.events.readonly`), and uses the same redirect URI, so nothing else changes in Google Cloud. Tokens are encrypted with AES-256-GCM. **Disconnect** revokes access with Google and deletes the tokens. Events are read live from Google and never stored; only meetings you confirm as being with someone are saved, as a conversation on that person's profile.

## Run it on your computer

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL (any Postgres) and the rest
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Set `DEV_LOGIN=1` in `.env.local` to get a "Local dev sign-in" button that skips Google. It is ignored in production builds.

```bash
npm test          # scoring, migration and network logic
npm run typecheck
```

## Privacy and security

- Only allowlisted Google accounts can sign in. Sign-in asks for name and email only.
- Every API route checks the session and that the request came from Kingdom's own pages. Every query is scoped to your user ID.
- The coach sees only what **Setup → What the coach can see** allows, and never sees people you've marked private. Context is rebuilt per question; no full histories are sent.
- **Setup → Your data** downloads everything as JSON or deletes the account and all its data.
- Errors are logged with a reference number, without personal content.
- Kingdom never connects to Cisco systems, work email or customer data.

## What's next

- **Phase 3:** suggested time blocks and an overload check, without writing to your calendar.
- **Phase 4, Gmail:** you pick labels and senders; you approve each summary.
- **Phase 5, LinkedIn:** import `Connections.csv` from LinkedIn's own data export; no scraping.
