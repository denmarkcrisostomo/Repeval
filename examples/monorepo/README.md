# Monorepo example

A small workspace with the things that tripped Repeval up in real monorepos:

- `apps/web` and `apps/api` each have their own `tsconfig.json` path alias (`@/*` and `@api/*`).
- `apps/web/lib/env.ts` checks the environment when it loads, like `@t3-oss/env`, and does not honour `SKIP_ENV_VALIDATION`.
- `apps/api/src/config.ts` does honour `SKIP_ENV_VALIDATION`; `apps/api/src/secrets.ts` reads a variable whose name is built at run time, so it can't be found in the code.
- `apps/web/lib/server-data.ts` imports Next's `server-only`.
- `packages/test` holds test helpers, which are not code to test.
