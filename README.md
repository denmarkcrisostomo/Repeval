<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/denmarkcrisostomo/Repeval/main/design/brand/logo-dark.svg">
    <img alt="Reval logo: the word Reval with a triangle for analyze, test and report" src="https://raw.githubusercontent.com/denmarkcrisostomo/Repeval/main/design/brand/logo-light.png" width="300">
  </picture>
</p>

# Repeval

**Repository + Evaluate.** Point Repeval at a JavaScript or TypeScript repo. It reads the code, writes unit and E2E tests, runs them, and gives you a report with a screenshot of every page.

```bash
npx repeval run ./my-app
```

No AI is needed for this version. AI mode (real assertions, user flows, self-healing tests) comes in a later release.

## What it does

```
Collect files → Understand the repo → Plan → Make tests → Run → Results
```

| Step | What happens |
|---|---|
| Collect | Finds source files, skipping `node_modules`, build output and test files. |
| Understand | Detects the stack (Next.js, Vite, Express, NestJS, SvelteKit, Remix, React Router…), maps exported functions with ts-morph, finds pages and API endpoints, and works out how to start the app. |
| Plan | Writes `.repeval/repeval-plan.json`: what to test, with which framework, at what priority. Anything it can't test yet is listed with a reason. |
| Make tests | Writes Vitest and Playwright files into `.repeval/`. Your own files are never touched. |
| Run | Installs dependencies if needed, starts your app, runs the tests. |
| Results | `repeval-report/index.html`: a flow view built with React Flow, every test result, a screenshot gallery and the generated code. It works offline. |

### The tests it writes (no AI)

- **Unit (Vitest):** checks that every exported function exists. For functions that look pure (no network, file system, time, randomness…), it builds sample arguments from the TypeScript types and records a **baseline** of what each call returns. Later runs compare against that baseline, so a change in behavior shows up as a possible bug.
- **Pages (Playwright):** opens every page and checks that it returns status < 400, shows content and has no browser errors. Each page is screenshotted at desktop and mobile width.
- **API (Playwright):** checks that every simple `GET` endpoint answers without a 5xx.

### Monorepos and environment variables

- **Each app's own aliases:** every `tsconfig.json` in the repo is read, and an import like `@/lib/format` is resolved with the tsconfig nearest the file that imports it. Next.js's `server-only` and `client-only` are replaced by empty modules in tests.
- **Test helpers are left alone:** code in `test/`, `tests/`, `e2e/`, `fixtures/` and `mocks/` folders only runs inside your own test setup, so Repeval doesn't write tests for it.
- **Made-up environment values:** many apps check their environment when a file loads (`@t3-oss/env`, envalid, a zod schema over `process.env`). Repeval never has your real values, so for the unit tests it makes up a safe one for every variable the code needs:
  - built to pass the variable's rule in your env schema (an enum's first option, a URL, an email, a `sk_` prefix, a minimum length…), or taken from `.env.example`, or guessed from the name (`DATABASE_URL` gets `postgres://…@localhost`);
  - variables named only in an error message (`PAYMENT_SECRET is missing`) get one too, and that file runs again.

  It also sets `SKIP_ENV_VALIDATION=1`, which `@t3-oss/env` setups commonly use to skip their checks. Your own `.env` files are never read, a variable that is already set is never changed, and the values only exist during the test run. A file that still can't load is listed as **Skipped · needs environment variables**, not as a bug.

### How results are sorted

| Status | Meaning |
|---|---|
| **Passed** | The test passed. |
| **Possible bug** | A valid test failed: a page threw an error, an endpoint returned 500, or a function's result changed. Repeval reports these and never weakens the test. |
| **Broken test** | The generated test itself couldn't run (for example, an import failed). |
| **Skipped** | Templates can't cover this yet (dynamic routes, POST bodies, React components, load tests), or the file needs environment variables Repeval couldn't fill in. The reason is shown. |

## Commands

```bash
npx repeval run [dir]        # everything below, in order
npx repeval analyze [dir]    # Collect + Understand: writes .repeval/analysis.json
npx repeval plan [dir]       # Plan: --tests all|unit|e2e|load, -i to review in a checklist
npx repeval generate [dir]   # Make tests: writes tests into .repeval/
npx repeval test [dir]       # Run + Results: runs them and writes repeval-report/
npx repeval report [dir]     # rebuild the HTML report from the last run
npx repeval init [dir]       # add .github/workflows/repeval.yml
```

Useful options:

- `--fail-on possible-bug|broken|never` sets when the exit code is 1. The default is `possible-bug`.
- `--update-baselines` records new baselines after an intended change.
- `--no-install` skips installing dependencies when `node_modules` is missing.
- `--out <dir>` changes the report folder.

Both `.repeval/` and `repeval-report/` contain their own `.gitignore`, so they never show up in `git status`. To keep a generated test, copy it from `repeval-report/generated/` into your repo.

## Run it in GitHub Actions

```bash
npx repeval init
```

This adds `.github/workflows/repeval.yml`. Read it before committing:

- It only runs when started by hand, from the Actions tab or the Repeval website, never on push.
- It gets `contents: read` only.
- The Repeval version is pinned.
- AI keys (for later) come from your repo's own secrets.

The report is uploaded as a run artifact and kept for 7 days. After Analyze, Plan and Generate, the workflow also saves a small names-only progress file (file paths, routes, function names and skip reasons, no code) for one day, so the website can draw the run while it goes.

The Repeval website starts this workflow for you. Tests run on GitHub's machines, and the website has no permission to read your code.

## Limits of this version

- JavaScript and TypeScript only.
- No AI mode yet, so no real assertions, user-flow tests or self-healing.
- No k6 load tests yet; they are planned and shown as skipped.
- Dynamic routes (`/products/:id`), POST endpoints and React components are skipped.
- **Local runs execute your project's code on your machine**, just like `npm test` would. Use GitHub Actions mode to run untrusted repos on a throwaway VM.

## Development

```bash
npm install
npm run build      # CLI (tsup) + report UI (esbuild, React Flow)
npm test           # analyzer, planner, generators, parsers, and full CLI runs on examples/
```

`examples/` holds three small repos used by the tests:
- `ts-lib`: a TypeScript library;
- `express-app`: pages plus an API, with a deliberate browser error on `/cart`;
- `next-app`: structure only, used by the analyzer tests.

## License

MIT
