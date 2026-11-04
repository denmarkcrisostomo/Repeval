# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js on Vercel (repeval.vercel.app), Auth.js with GitHub login and a JWT session in an encrypted cookie (no database), React Flow (`@xyflow/react`, MIT) for the run view. Prototypes and mockups are plain HTML/CSS/JS until the real build starts.

## Users

- **Solo developers and indie hackers** shipping side projects with few or no tests, who want a safety net without writing tests by hand.
- **New "vibe coders"** who built an app (often with AI help) and don't know how to test it.
- **Students and beginners** learning what good tests look like, using their own code.
- **Small teams and QA** adding coverage to an existing product repo.

All of them use the same flow: sign in with GitHub, pick a repo, run Repeval, read the report. Many have never written a test, so screens must explain results in plain words (passed, possible bug, broken test, skipped), not testing jargon.

## Product Purpose

Repeval (Repository + Evaluate) reads a JS/TS repository, generates unit (Vitest) and E2E (Playwright) tests, runs them, and produces a report with a screenshot of every page. It runs two ways: `npx repeval` locally, or from the website, which starts the run inside the user's own GitHub Actions. Success: a person with no tests gets a real, readable picture of what works and what is broken in their app within minutes, plus test files they can keep.

## Positioning

- **The code never leaves GitHub.** The website asks GitHub for only Actions and Metadata permissions (no Contents permission), so it cannot read the code. It has no database, and runs happen on GitHub's temporary VMs in the user's own repo.
- **Free and open source (MIT).**
- **Works without AI.** Template tests work with no AI; AI mode, which brings your own key or a local Ollama model, comes later.
- **Same tool in both places.** The CLI and the website run the same pipeline.

## Operating Context

- **The pipeline:** Collect files → Understand the repo → Plan → Make tests → Run → Results.
- **Website flow:**
  1. Sign in with GitHub (consent screen lists Actions + Metadata only).
  2. Pick a repo.
  3. Add `.github/workflows/repeval.yml` via GitHub's own prefilled "new file" page; the user commits it themselves.
  4. Start a run (workflow_dispatch with choice inputs: ai none|anthropic|openai, tests all|unit|e2e|load).
  5. Watch live step status as a flow graph.
  6. Read the report, streamed from the run artifact and never stored.
- **Result vocabulary:** passed, possible bug, broken test (the generated test itself is wrong), skipped (always with a reason).
- **Artifacts:** the report artifact is kept 7 days in the user's repo. Generated tests can be downloaded and moved into the repo.

## Capabilities and Constraints

**Working in CLI v0.1.0:**
- stack detection (Next.js, Vite, Express, Fastify, Hono, SvelteKit, Remix, React Router);
- function mapping with type-based sample arguments;
- baseline unit tests;
- page smoke tests with desktop and mobile screenshots;
- GET endpoint checks;
- an offline HTML report with a React Flow pipeline view;
- `repeval init` for the workflow file.

**Not yet built:** AI mode, k6 load tests, dynamic routes, POST bodies, component tests, other languages, the website itself.

**Constraints:**
- The website must never store code, reports or user data.
- Runs must only start when the user starts them.

## Brand Commitments

- **Name:** Repeval (Repository + Evaluate). CLI command `repeval`; domain repeval.vercel.app.
- **Brand color is teal** (user-provided, binding):
  - `--s-teal: #00bba7`
  - `--s-teal-hi: #2dd4bf`
  - `--s-teal-ink: #5eead4`
  - `--s-teal-deep: #134e4a`
  - `--s-teal-soft: rgba(0,187,167,.16)`
- No logo or typeface exists yet.

## Evidence on Hand

**Real and usable:**
- the working CLI and its real output: terminal logs, generated test files, `results.json`, and the HTML report with flow view, tests list and screenshot gallery;
- example repos in `examples/`, including the Express demo shop with a deliberate `/cart` browser error that Repeval catches;
- `repeval-report-example.png`.

**Absent, never to be fabricated:** users, testimonials, company logos, download counts, GitHub stars, benchmarks and pricing tiers. Repeval is free.

## Product Principles

1. Nothing hidden: every permission, file and step is visible and explained before it happens.
2. Plain words over testing jargon. Every result says what it means and what to do next.
3. Proof over promises: show real output (screenshots, generated code, the flow), not claims.
4. Never weaken a test to make it pass. Possible bugs are reported, not hidden.
5. Free, local-first and private by default.

## Accessibility & Inclusion

Beginners are a core audience, so plain language is required. Status is never shown by colour alone: every status also has a label. Both light and dark themes must work.
