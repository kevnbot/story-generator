<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16.2.4 and React 19.2.4. Before changing Next.js code, read the relevant local guide under `node_modules/next/dist/docs/`. Next 16 changes important APIs and conventions, including `proxy.ts`, async `params` and `searchParams`, async `cookies()`, route type helpers, and removal of `next lint`.

If `node_modules/next/dist/docs/` is missing, run `npm install` first and then read the relevant docs before editing.
<!-- END:nextjs-agent-rules -->

# Agent Guide

## Project Summary

This is a private Next.js App Router application for generating personalized children's stories. It uses Supabase for auth, data, and storage references; Anthropic for story and visual planning; fal.ai for images; Upstash Redis for rate limiting; and optional Resend, Twilio, and Stripe integrations.

Primary user flows:
- Sign up or log in through Supabase auth.
- Create and manage child profiles.
- Generate text stories, optionally with illustrations.
- Read and manage generated stories in the library.
- Admin users can inspect prompts and configuration.

## Tech Stack

- Next.js `16.2.4` with App Router in `app/`.
- React `19.2.4`.
- TypeScript with strict mode and `@/*` path aliases.
- Tailwind CSS v3 plus small shadcn-style primitives in `components/ui/`.
- Supabase SSR client via `@supabase/ssr`.
- Anthropic SDK for story generation.
- fal.ai HTTP API calls from server-side code.
- Upstash Redis rate limits.
- Vercel runtime logs for error monitoring and structured logs (via `lib/logger.ts`).
- Server-side comms through Resend and Twilio.

## Commands

Use npm; this repo has `package-lock.json`.

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Start production server after build: `npm run start`
- Generate Next route types without a full build: `npx next typegen`
- Lint with Next 16: `npm run lint` (runs `eslint .`)
- Unit/component/server tests: `npm run test:unit`
- Unit test watch mode: `npm run test:unit:watch`
- Playwright E2E tests: `npm run test:e2e`
- Playwright UI mode: `npm run test:e2e:ui`
- Full local validation: `npm run test:all`

Important caveats:
- `npm run db:migrate` points to `db/migrate.js`, but that file is not present in this checkout. Do not assume the script works.

## Environment

Start from `.env.local.example`.

Required for core app behavior:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional or feature-specific:
- `FAL_KEY` enables profile references and story illustrations.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable real rate limiting; without them the app allows requests locally.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable email sends.
- `TWILIO_*` variables enable SMS and 2FA helpers.
- `STRIPE_*` variables are listed but checkout/webhook implementation may not be complete.
- `ADMIN_USER_IDS` is a comma-separated allowlist for `/admin`.

Never expose service role keys, Anthropic keys, fal keys, Twilio credentials, Stripe secrets, or Redis tokens to Client Components.

## Repository Map

- `app/layout.tsx`: root layout, Geist fonts, global CSS.
- `app/page.tsx`: public landing/root route.
- `app/(auth)/`: login, signup, verify email routes.
- `app/(dashboard)/`: authenticated application routes.
- `app/actions/`: Server Functions for auth, profile, and story mutations.
- `app/api/generate-story/route.ts`: authenticated streaming story generation endpoint.
- `app/api/auth/callback/route.ts`: Supabase auth callback.
- `lib/logger.ts`: structured JSON logger (`logger.*`, `logError`) written to stdout/stderr for Vercel runtime logs.
- `lib/api/with-logging.ts`: `withRouteLogging` wrapper that gives Route Handlers try/catch + structured error logging.
- `instrumentation.ts`: exports `onRequestError` to log Server Component, Proxy, and request errors via `lib/logger.ts`.
- `proxy.ts`: Next 16 Proxy for auth redirects and admin guarding.
- `components/generate/`: client story generation UI.
- `components/profiles/`: profile list and form UI.
- `components/stories/`: story management UI.
- `components/library/`: library, reader, book cards, filters, prompt modal.
- `components/admin/`: prompt inspection UI.
- `components/ui/`: local UI primitives.
- `tests/unit/`: Vitest tests for pure helpers and business logic.
- `tests/components/`: Vitest + Testing Library tests for Client Components.
- `tests/server/`: mocked Vitest tests for Route Handlers and Server Functions.
- `tests/e2e/`: mocked-first Playwright browser tests.
- `tests/setup/vitest.ts`: Vitest global setup and stable Next/browser mocks.
- `app/test-harness/`: guarded E2E-only fixture routes used by Playwright.
- `lib/supabase/`: server and browser Supabase clients.
- `lib/ai/`: story generation, image generation, and prompt builders.
- `lib/rate-limit/`: Upstash-backed story and SMS rate limits.
- `lib/comms/`: Resend and Twilio helpers.
- `lib/config/`: app config reads from Supabase with short in-memory cache.
- `db/migrations/`: SQL migrations and seed data.
- `types/`: shared database and API types.

## Next.js 16 Rules For This Repo

- Use `proxy.ts` for request interception. The old `middleware.ts` convention is deprecated in Next 16.
- Proxy can skip Server Function requests when matchers change. Always authenticate and authorize inside Server Functions and Route Handlers too.
- `cookies()` from `next/headers` is async. Always `await cookies()`.
- App Router `params` and `searchParams` are promises in pages, layouts, and route handlers. `await` them or use React `use()` in Client Components.
- Prefer route helpers after type generation:
  - `PageProps<'/route'>`
  - `LayoutProps<'/route'>`
  - `RouteContext<'/route'>`
- Client Components require `"use client"` only at client entry files. Keep browser state, effects, and event handlers there.
- Server Function files should use `"use server"` and must validate auth, authorization, and inputs.
- Route Handlers in `app/api/**/route.ts` should use Web `Request`/`Response` APIs or `NextRequest`/`NextResponse` where needed.
- `next lint` is gone. Use the ESLint CLI with the flat config in `eslint.config.mjs`.

## Security And Data Access

- Treat `createServiceClient()` as privileged. Use it only in server-only files, after checking the authenticated user and scoping by `account_id`.
- Do not rely on Proxy as the only auth boundary. Mutations in `app/actions/*` and APIs must call `createClient().auth.getUser()`.
- Every query that reads or mutates user data should be scoped by the caller's `account_id` and should respect `deleted_at` soft deletes where applicable.
- Keep client payloads small and non-sensitive. Server Function return values are serialized to the client.
- Validate external inputs from `FormData`, JSON bodies, query params, and route params before database writes.
- Never log full prompts together with secrets, auth tokens, service keys, phone numbers, or payment data.

## Logging

- Logging goes through `lib/logger.ts`, which writes structured JSON lines to stdout/stderr. Vercel's runtime logs capture and index these automatically — there is no external logging SDK.
- Use `logger.info/warn/error(message, context?)` for operational events and `logError(message, error, context?)` for caught exceptions (it serializes the error name/message/stack into the log entry).
- Wrap authenticated Route Handlers with `withRouteLogging("route/name", handler)` from `lib/api/with-logging.ts`. It catches uncaught exceptions, logs them as structured JSON, and returns a generic 500. The auth check stays as the first lines inside the wrapped handler.
- Server Functions in `app/actions/*` wrap their body in try/catch, call `logError("<action> failed", error, { action })`, and rethrow so the framework still surfaces the error.
- `instrumentation.ts` exports `onRequestError` to log Server Component, Proxy, and request errors via `logError`.
- Use structured attributes with snake_case keys, such as `user_id`, `account_id`, `job_id`, `provider`, `model`, `status_code`, `profile_count`, `story_length`, and `image_count`.
- Do not log full prompts, generated story content, child appearance/toy details beyond IDs or counts, raw provider response bodies, service role keys, provider API keys, auth tokens, phone numbers, email bodies, or payment data.

## Data Model Notes

Main tables are defined by SQL in `db/migrations/`.

- `accounts`: family account and credit balance.
- `users`: Supabase auth user profile and account membership.
- `kid_profiles`: child profile data, prompt summaries, optional reference image URL, soft deletes.
- `story_templates`: active story template prompts.
- `generation_jobs`: generation lifecycle and credit holds.
- `stories`: generated story content, image metadata, versioning, soft deletes.
- `credit_transactions`: credit audit log.
- `notification_preferences` and `comms_log`: email/SMS preferences and delivery logs.
- `app_config`: runtime config values read through `lib/config`.
- Later migrations add age months, gender, art styles, story versioning, profile reference images, and updated templates.

When changing schema:
- Add a new migration file; do not edit old applied migrations unless explicitly asked.
- Update `types/index.ts`.
- Update queries, actions, and UI forms together.
- Check RLS policies and service role usage.

## Story Generation Flow

The main endpoint is `app/api/generate-story/route.ts`.

High-level flow:
1. Authenticate with Supabase SSR client.
2. Parse JSON body for profile IDs, art style, story length, story request, images, parent story, and revision feedback.
3. Check story rate limit.
4. Use service role client to load account, profiles, active template, optional parent story, and optional art style.
5. Check credit balance.
6. Insert a `generation_jobs` row.
7. Stream text chunks from Anthropic to the client.
8. Extract title and optionally generate image prompts and fal.ai images.
9. Insert the story, decrement credits, write a credit transaction, and complete the job.
10. On failure, mark the job failed and stream a generic error.

Important behavior:
- `STORY_LENGTHS` controls page count, image count, and image credit cost.
- Images are only enabled when requested and `FAL_KEY` exists.
- Child appearance is intentionally omitted from story-writing prompts when reference images handle illustration identity.
- Image prompts include explicit rules to keep children human and toys separate physical objects.
- Credit deductions, story insert, and job completion are currently separate operations. Be careful when changing error handling or ordering.

## UI Conventions

- Follow existing Tailwind utility style and the HSL CSS variables in `app/globals.css`.
- Reuse `components/ui/button.tsx`, `input.tsx`, and `label.tsx` before adding new primitives.
- Use `lucide-react` for icons when adding icon buttons or controls.
- Keep Server Components as the default for route pages and data loading. Move only interactive stateful surfaces into Client Components.
- Internal navigation should use Next-compatible links where practical. Some existing components use `<a>`; avoid broad rewrites unless part of the task.
- Preserve route groups:
  - `(auth)` for public auth pages.
  - `(dashboard)` for authenticated app pages.

## Code Style

- TypeScript strict mode is enabled. Avoid `any`; if existing code uses `any`, do not spread it further.
- Use `@/*` imports for project modules.
- Keep server-only utilities out of Client Components.
- Prefer small, direct helpers over new abstractions unless duplication or complexity justifies them.
- Keep comments sparse and useful. Existing comments usually explain prompt, image, auth, or database intent.
- Use ASCII text in source and docs unless a file already has a clear reason for Unicode.

## Testing And Verification

This checkout has Vitest and Playwright coverage. For changes, use the narrowest meaningful checks:

- Unit/component/server tests: `npm run test:unit`
- Playwright E2E tests: `npm run test:e2e`
- Lint: `npm run lint`
- Type and production validation: `npm run build`
- Full local validation: `npm run test:all`
- Next route helper generation: `npx next typegen`
- Manual smoke test with `npm run dev`:
  - Auth redirect behavior.
  - Profile create/update/delete.
  - Story generation without images.
  - Story generation with images when `FAL_KEY` is configured.
  - Library story reader and delete flow.
  - Admin access with and without `ADMIN_USER_IDS`.

Testing conventions:
- Vitest config lives in `vitest.config.ts` and uses jsdom, React Testing Library, global test APIs, and native tsconfig path resolution.
- Keep unit tests fast and mocked. Mock Supabase, Anthropic, fal.ai, Redis, Twilio, Stripe, Resend, and Next navigation/cache APIs rather than calling external services.
- Prefer pure helper coverage in `tests/unit/`; Client Component behavior in `tests/components/`; narrow mocked Route Handler or Server Function tests in `tests/server/`.
- Playwright config lives in `playwright.config.ts` and starts `npm run dev` with dummy non-secret env values and `NEXT_PUBLIC_E2E_TEST=true`.
- Playwright should stay mocked-first. Intercept `/api/**` calls with `page.route()` instead of requiring real Supabase/auth/provider credentials.
- The `app/test-harness/*` routes are for Playwright fixtures only. They must stay guarded by `NEXT_PUBLIC_E2E_TEST` and must not expose secrets or real provider mocks to browser code.
- If Playwright browsers are missing locally, run `npx playwright install chromium`.

If a check cannot run because credentials are missing, state that clearly in the final response and explain what was verified instead.

For logging changes specifically:
- Run `npm run build` to validate `instrumentation.ts` and Route Handler wrappers type-check.
- Run `npm run lint` or explain any unrelated pre-existing failures.
- Trigger one safe handled failure and confirm a structured JSON line (`{"level":"error",...}`) appears in the server/Vercel runtime logs.

## Common Pitfalls

- Do not add `middleware.ts`; use `proxy.ts`.
- Do not call `cookies()` synchronously.
- Do not treat `params` or `searchParams` as plain objects in new App Router code.
- Do not put `SUPABASE_SERVICE_ROLE_KEY` or AI provider keys in browser-executed code.
- Do not bypass account scoping when using the service role client.
- Do not use `next lint`; Next 16 removed it. Use `npm run lint` or `npx eslint .`.
- Do not run or rely on `npm run db:migrate` until `db/migrate.js` exists.
- Do not reintroduce an external logging SDK; log through `lib/logger.ts` so Vercel runtime logs capture structured output.
- Do not make Playwright depend on real Supabase or AI/image provider credentials unless explicitly asked.
- Do not remove the `NEXT_PUBLIC_E2E_TEST` guard from `app/test-harness/*` routes.
- Do not change prompt structure casually; story and image prompts contain guardrails for age-appropriateness, character consistency, and toy/child separation.
- Do not deduct credits for failed generation paths without confirming job and story state transitions.

## Pre-Change Checklist

Before editing:
1. Read the relevant local Next docs in `node_modules/next/dist/docs/`.
2. Inspect the target files and nearby patterns.
3. Check whether the file is server-only or client-executed.
4. Identify auth, account scoping, credit, and external API implications.
5. Decide which verification command can actually run in the current environment.

Before finishing:
1. Run `npm run lint` or explain why it could not run.
2. Run `npm run test:unit` for logic, component, route handler, or Server Function changes.
3. Run `npm run build` for broad app changes, or explain why it could not run.
4. Run `npm run test:e2e` for auth, navigation, generation UI, or library flow changes.
5. Mention any missing env vars, unavailable services, or known script gaps.
