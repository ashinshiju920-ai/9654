# Aylem Learning Student Portal

Standalone student portal for Aylem Learning. This repository is intentionally separate from the
marketing website and does not include payment or Cashfree integration.

## Recommended Stack

- **Next.js App Router + TypeScript** for course pages, server routes, SSR-friendly authentication,
  and a clear split between server and client components.
- **Cloudflare Workers deployment via `vinext`** because Cloudflare's current Workers docs recommend
  `vinext` as the default path for full-stack Next.js apps on Workers.
- **Supabase Auth + Postgres** for login, roles, editable course PDFs, quiz questions, quiz attempts,
  and admin workflows.
- **Cloudflare R2** for private PDF objects. The browser should never receive permanent object keys;
  downloads should go through server-only authorization and short-lived signed access.
- **Bun** for package management in this workspace, matching the local toolchain.
- **Vitest + Testing Library**, **ESLint**, **Prettier**, and **TypeScript** for tests, linting,
  formatting, and type checking.

Cloudflare adapter commands require **Node.js 22.12+**. The plain Next.js build works on the local
Node 20.18 runtime, but `vinext` and Vite need a newer Node runtime for Cloudflare builds.

## Folder Structure

```text
src/
  app/
    page.tsx                  # Student portal landing screen
    courses/[slug]/page.tsx   # One page per course with published PDFs and quiz link
    courses/[slug]/quiz/      # Quiz attempt entry route
    api/pdfs/[id]/route.ts    # Server-only PDF delivery boundary
  lib/
    courses.ts                # Course registry: IELTS, OET, PTE, German
    quiz.ts                   # Quiz selection/shuffle logic
    supabase/
      browser.ts              # Browser Supabase client
      server.ts               # Server Supabase client using cookies
```

## Server and Client Boundaries

- Course pages are server components by default. They should read published PDFs from Supabase after
  auth is wired.
- Quiz attempt creation must happen on the server so the selected shuffled question IDs can be locked
  for the attempt.
- Admin PDF/question management should write to Supabase through authenticated server actions or route
  handlers.
- PDF files stay private in R2. The browser calls `/api/pdfs/[id]`; that route verifies Supabase
  access and returns a short-lived download response.
- `NEXT_PUBLIC_*` variables are safe for browser use. Service-role keys and R2 credentials must stay
  server-only.

## Local Setup

```bash
bun install
cp .env.local.example .env.local
bun run dev
```

Fill `.env.local` with real local credentials when Supabase and R2 projects exist. The committed env
files contain placeholders only.

## Quality Commands

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
```

## Cloudflare Commands

```bash
bun run build:vinext
bun run start:vinext
bun run deploy:vinext
```

Update `cloudflare.config.ts` with the real private R2 bucket binding before deploying.
