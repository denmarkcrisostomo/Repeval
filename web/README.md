# Repeval website

The website for [Repeval](../README.md). Sign in with GitHub, pick a repo, press Run, watch the steps live and read the report with every screenshot.

It stores nothing:

- **No database.** The session is an encrypted cookie (Auth.js, JWT) that lasts 8 hours. Signing out deletes it and revokes the GitHub token.
- **No access to code.** The GitHub App asks for **Actions** (read and write) and **Metadata** (read) only. Without the Contents permission it cannot read a single file.
- **Runs happen in the user's own GitHub Actions.** The site only starts the workflow and reads its step status.
- **Reports are streamed, not stored.** The report zip goes from GitHub through `/api/.../report` to the browser, which unzips it in memory.

## Run it locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

With no GitHub App configured, the site runs in **demo mode**: example repos, a simulated run and the real demo-shop report from `examples/express-app`. Everything works except talking to GitHub.

## Connect a GitHub App

1. On GitHub: **Settings → Developer settings → GitHub Apps → New GitHub App**.
   - **Homepage URL:** your site, for example `https://repeval.vercel.app`.
   - **Callback URL:** `https://<your site>/api/auth/callback/github` (and `http://localhost:3000/api/auth/callback/github` for local work).
   - **Expire user authorization tokens:** on.
   - **Setup URL** (under Post installation): `https://<your site>/repos`, with **Redirect on update** ticked. Without it, GitHub leaves people on its own settings page after they install the app or change its repos.
   - **Webhook:** turn off "Active". The site doesn't use webhooks.
   - **Repository permissions:** Actions: *Read and write*. Metadata: *Read-only*. Leave everything else on *No access*, including Contents.
   - **Account permissions:** none.
   - **Where can this app be installed:** Any account.
2. Generate a client secret.
3. Copy `.env.example` to `.env.local` and fill it in:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | Random string, from `npx auth secret` |
| `AUTH_GITHUB_ID` | The app's **Client ID** |
| `AUTH_GITHUB_SECRET` | The client secret |
| `GITHUB_APP_SLUG` | The app's URL name, as in `github.com/apps/<slug>` |
| `REPEVAL_REPO_URL` | Optional: footer GitHub link, if you deploy a fork (defaults to github.com/denmarkcrisostomo/Repeval) |

Users install the app on the repos they choose (the "Allow more repos on GitHub" button links to the install page), then sign in.

## Deploy on Vercel

Import the repository, set **Root Directory** to `web`, and add the variables above. `npm run build` first checks that `lib/workflow.ts` still matches `templates/repeval.yml`.

## The workflow file

- It runs `npx repeval@0.1`, so bug-fix releases (0.1.x) reach every repo without anyone editing the file.
- Its `name:` carries a template version, `Repeval (workflow v3)`. The site reads that name through the Actions API (no Contents permission needed) and shows **Update the workflow file** when a repo has an older one. When you change the template, bump the version in both `templates/repeval.yml` and `WORKFLOW_NAME` in `lib/workflow.ts`; the build checks they match.
- **Commit to a branch** on the report starts the same workflow with `save_from_run=<run id>`. Its `save-tests` job downloads that run's report and pushes the generated tests to the `repeval-tests` branch with the repo's own token. Only that job gets `contents: write`; the Repeval app's permissions don't change. The site then links to GitHub's pull request page.

## How it fits together

| Path | What it does |
|---|---|
| `app/page.tsx` | Landing page |
| `app/signin` | Explains the permissions, then signs in with GitHub (or the demo) |
| `app/repos` | Repos the user allowed, with whether each has the workflow file |
| `app/repos/[owner]/[repo]` | Adds the workflow (GitHub's own prefilled "new file" page) or starts a run |
| `app/repos/[owner]/[repo]/runs/[runId]` | Live run as a flow diagram, polling the run's steps and its names-only progress |
| `.../runs/[runId]/report` | The report, unzipped in the browser, with **Commit to a branch** |
| `api/.../runs/[runId]/save` | Starts the save-tests job for that run |
| `lib/github.ts` | GitHub REST calls, server only, with the user's token |
| `lib/demo.ts` | Demo mode: example repos and a simulated run |
| `lib/session.ts` | Reads the user and token from the encrypted cookie |
