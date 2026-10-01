# Aylem Student Portal — VPS Migration Plan

## Phase 1, Step 1: Complete Technical Audit + Migration Architecture

> **Status**: AUDIT ONLY — no code changes have been made.
> **Date**: 2026-10-01

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Complete List of Supabase-Dependent Files](#2-complete-list-of-supabase-dependent-files)
3. [Supabase Dependency Map](#3-supabase-dependency-map)
4. [Current Authentication Flow](#4-current-authentication-flow)
5. [Current Database / Schema Summary](#5-current-database--schema-summary)
6. [Cloudflare / vinext / R2 Dependency Summary](#6-cloudflare--vinext--r2-dependency-summary)
7. [Recommended IndiaHost VPS Architecture](#7-recommended-indiahost-vps-architecture)
8. [Recommended Database Approach](#8-recommended-database-approach)
9. [Recommended Authentication / Session Approach](#9-recommended-authentication--session-approach)
10. [Security Considerations](#10-security-considerations)
11. [Exact Migration Sequence](#11-exact-migration-sequence)
12. [Files That Will Need Modification](#12-files-that-will-need-modification)
13. [Files That Can Remain Unchanged](#13-files-that-can-remain-unchanged)
14. [Risks and Compatibility Problems](#14-risks-and-compatibility-problems)
15. [Proposed Phase 1 — Step 2 Implementation Plan](#15-proposed-phase-1--step-2-implementation-plan)

---

## 1. Current Architecture Summary

```
Student Browser
      │
      ├─ Public pages (login, signup, forgot-password, reset-password, thank-you)
      │    └─ Client-side Supabase Auth via @supabase/ssr (browser client)
      │
      ├─ Protected pages (dashboard, courses/[slug], quiz, results, profile, support)
      │    └─ Server-side Supabase Auth check via @supabase/ssr (server client)
      │
      ├─ Middleware (src/proxy.ts → src/lib/supabase/proxy.ts)
      │    └─ Supabase session refresh + redirect unauthenticated users from /dashboard/*
      │
      ├─ API Routes
      │    ├─ /api/pdfs/[id]              → 308 redirect to /api/materials/[pdfId]/download
      │    └─ /api/materials/[pdfId]/download → Auth check (Supabase) → DB lookup (Supabase admin) → R2 signed URL
      │
      ├─ Auth Callback
      │    └─ /auth/callback              → Supabase code→session exchange (OAuth/email verify)
      │
      └─ Data Layer
           ├─ Supabase PostgreSQL (course_pdfs, courses, questions, quiz_attempts, etc.)
           ├─ Supabase Auth (users, sessions, JWT, password hashing, email verification)
           └─ Cloudflare R2 (private PDF files, accessed via S3-compatible API)
```

**Framework**: Next.js 16.3 App Router + TypeScript + React 19.3
**Runtime**: Bun 1.4 (package manager), Node 22.12+ (for Cloudflare builds)
**Deployment target (current)**: Cloudflare Workers via vinext
**Deployment target (future)**: IndiaHost VPS (standard Node.js server)

---

## 2. Complete List of Supabase-Dependent Files

### Supabase Client Infrastructure (will be DELETED/REPLACED entirely)

| File | Role |
|------|------|
| `src/lib/supabase/browser.ts` | Browser-side Supabase client (`createBrowserClient`) |
| `src/lib/supabase/server.ts` | Server-side Supabase client (cookie-based, for Server Components) |
| `src/lib/supabase/admin.ts` | Admin/service-role Supabase client (bypasses RLS) |
| `src/lib/supabase/proxy.ts` | Middleware session refresh + auth guard for `/dashboard/*` |

### Middleware

| File | Role |
|------|------|
| `src/proxy.ts` | Next.js middleware entry point — delegates to `supabase/proxy.ts` |

### Authentication Pages (use browser Supabase client)

| File | Supabase API Used |
|------|-------------------|
| `src/app/login/login-form.tsx` | `supabase.auth.signInWithPassword()`, `supabase.auth.signInWithOAuth()` |
| `src/app/signup/signup-form.tsx` | `supabase.auth.signUp()` |
| `src/app/logout/page.tsx` | `supabase.auth.signOut()` |
| `src/app/forgot-password/forgot-password-form.tsx` | `supabase.auth.resetPasswordForEmail()` |
| `src/app/reset-password/reset-password-form.tsx` | `supabase.auth.updateUser()` |
| `src/app/auth/callback/route.ts` | `supabase.auth.exchangeCodeForSession()` |

### Protected Pages (use server Supabase client for auth check)

| File | Supabase Usage |
|------|----------------|
| `src/app/dashboard/page.tsx` | `supabase.auth.getUser()` → redirect if not authed |
| `src/app/courses/[slug]/page.tsx` | `supabase.auth.getUser()` → redirect if not authed |

### Data Access Layer (use Supabase DB queries)

| File | Supabase Usage |
|------|----------------|
| `src/lib/materials.ts` | `supabase.from("course_pdfs").select(…)` via server client |
| `src/app/api/materials/[pdfId]/download/route.ts` | `supabase.auth.getUser()` + `adminSupabase.from("course_pdfs").select(…)` |

### Auth Utilities (Supabase-aware but portable)

| File | Supabase Connection |
|------|---------------------|
| `src/app/auth/auth-utils.ts` | `getAuthRedirectUrl()` builds callback URLs for Supabase OAuth; `toAuthMessage()` maps Supabase error strings |

### Pages with Supabase Mentions in UI Text Only (no functional dependency)

| File | Type |
|------|------|
| `src/app/forgot-password/page.tsx` | Subtitle text says "Supabase will send a secure reset link" |
| `src/app/dashboard/dashboard-content.tsx` | Toast text: "Supabase and R2 wiring are ready…" |
| `src/app/profile/page.tsx` | Placeholder text mentions "Supabase auth" |
| `src/app/results/page.tsx` | Placeholder text mentions "Supabase attempt storage" |

### Package Dependencies

| Package | Version | Location |
|---------|---------|----------|
| `@supabase/ssr` | 0.12.7 | `dependencies` in package.json |
| `@supabase/supabase-js` | 2.117.2 | `dependencies` in package.json |

### Environment Variables

| Variable | Used In | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | browser.ts, server.ts, admin.ts, proxy.ts, login-form.tsx | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser.ts, server.ts, proxy.ts, login-form.tsx | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | admin.ts | Supabase service-role key |

### Environment/Config Files

| File | Supabase Content |
|------|------------------|
| `.env.local` | Contains live Supabase URL + publishable key |
| `.env.example` | Template with Supabase vars |
| `.env.local.example` | Template with Supabase vars |
| `.dev.vars.example` | Template with Supabase vars (Cloudflare dev) |

### Database Schema Files

| File | Content |
|------|---------|
| `supabase/migrations/20260929152000_core_student_portal_schema.sql` | Core schema: 7 tables, triggers, RLS policies, `is_admin()` function |
| `supabase/migrations/20260929153500_tune_core_schema_policies.sql` | Revised RLS policies, additional indexes |

### Documentation

| File | Supabase Content |
|------|------------------|
| `README.md` | References Supabase Auth + Postgres throughout |
| `DEPLOYMENT.md` | Lists Supabase env vars as required Worker secrets |

---

## 3. Supabase Dependency Map

| Supabase Feature | Current Code Using It | What Breaks If Removed | Replacement Required |
|---|---|---|---|
| Auth (signInWithPassword) | login-form.tsx → browser.ts | Email/password login stops working | Custom /api/auth/login route + session cookie |
| Auth (signInWithOAuth) | login-form.tsx → browser.ts | Google OAuth login stops working | Custom OAuth flow (Google client ID + callback) |
| Auth (signUp) | signup-form.tsx → browser.ts | Student registration stops working | Custom /api/auth/signup route + password hashing |
| Auth (signOut) | logout/page.tsx → browser.ts | Logout stops working | Custom /api/auth/logout route + session clear |
| Auth (resetPasswordForEmail) | forgot-password-form.tsx → browser.ts | Password reset email stops sending | Custom email sending + reset token flow |
| Auth (updateUser) | reset-password-form.tsx → browser.ts | Password update stops working | Custom /api/auth/reset-password route |
| Auth (exchangeCodeForSession) | auth/callback/route.ts → server.ts | OAuth callback & email verify break | Custom callback handler |
| Auth (getUser) — server | dashboard/page.tsx, courses/[slug]/page.tsx, download/route.ts | All server-side auth guards break | Custom session validation middleware |
| Auth (getUser) — proxy | proxy.ts → supabase/proxy.ts | Middleware auth guard for /dashboard/* breaks | Custom middleware checking session cookie |
| PostgreSQL queries | materials.ts, download/route.ts | PDF metadata lookup + download auth breaks | Direct PostgreSQL queries via Drizzle ORM |
| Admin client (bypasses RLS) | download/route.ts | Server-side DB queries that bypass RLS break | Standard privileged DB connection (no RLS needed) |
| RLS policies | 2 migration files | Row-level security at DB level is lost | Equivalent authorization in server-side API logic |
| is_admin() function | Both migration files | Admin role checking breaks | Custom role check (user.role column) |
| handle_new_user trigger | Migration file | Auto profile creation on signup breaks | Create profile row in signup API handler |
| JWT (app_metadata.role) | is_admin() SQL function | Admin detection breaks | role column in users table |
| @supabase/ssr package | browser.ts, server.ts, proxy.ts | Cookie-based session management breaks | Custom cookie session (jose JWT) |
| @supabase/supabase-js package | admin.ts | Admin DB client breaks | Standard pg driver or ORM |

---

## 4. Current Authentication Flow

### Login (Email/Password)

```
1. Student loads /login
2. login-form.tsx (client component) renders form
3. On submit → createClient() from browser.ts → supabase.auth.signInWithPassword({email, password})
4. Supabase Auth validates credentials, returns session
5. @supabase/ssr stores session tokens in cookies automatically
6. router.replace("/dashboard") + router.refresh()
7. On /dashboard load → middleware (proxy.ts) runs:
   a. createServerClient() reads cookies
   b. supabase.auth.getUser() validates session with Supabase
   c. If no user → redirect to /login?next=/dashboard
   d. If valid → forward request
8. dashboard/page.tsx (Server Component) double-checks:
   a. createClient() → supabase.auth.getUser()
   b. If no user → redirect("/login")
   c. If valid → render <DashboardContent />
```

### Login (Google OAuth)

```
1. Student clicks "Continue with Google"
2. login-form.tsx → supabase.auth.signInWithOAuth({ provider: "google", redirectTo: "/auth/callback?next=/dashboard" })
3. Browser redirects to Supabase → Google → back to Supabase → /auth/callback?code=…
4. auth/callback/route.ts → supabase.auth.exchangeCodeForSession(code)
5. Session cookies set → redirect to /dashboard
```

### Signup

```
1. Student fills form at /signup
2. signup-form.tsx → supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: "/auth/callback" } })
3. Supabase creates user in auth.users
4. Trigger on_auth_user_created → private.handle_new_user() → INSERT into profiles
5. If email confirmation required → "Check your email" message
6. If auto-confirmed → redirect to /dashboard
```

### Logout

```
1. Student navigates to /logout
2. logout/page.tsx (client) → supabase.auth.signOut()
3. Session cookies cleared → redirect to /login
```

### Password Reset

```
1. /forgot-password → supabase.auth.resetPasswordForEmail(email, { redirectTo: "/reset-password" })
2. Supabase sends email with magic link
3. Student clicks link → /auth/callback → exchanges code → session set
4. Redirect to /reset-password
5. reset-password-form.tsx → supabase.auth.updateUser({ password })
```

### Session Refresh (Middleware)

```
1. Every request matching /dashboard/:path* or /auth/callback
2. proxy.ts → updateSession(request)
3. supabase/proxy.ts:
   a. Creates server client reading cookies from request
   b. Calls supabase.auth.getUser() (refreshes token if needed)
   c. If expired/invalid + path is /dashboard/* → redirect to /login
   d. Supabase SDK automatically sets refreshed cookies on response
```

### Files Involved in Auth Flow

| Step | File |
|------|------|
| Middleware entry | `src/proxy.ts` |
| Session refresh logic | `src/lib/supabase/proxy.ts` |
| Browser client factory | `src/lib/supabase/browser.ts` |
| Server client factory | `src/lib/supabase/server.ts` |
| Admin client factory | `src/lib/supabase/admin.ts` |
| Login form | `src/app/login/login-form.tsx` |
| Signup form | `src/app/signup/signup-form.tsx` |
| Logout page | `src/app/logout/page.tsx` |
| Forgot password form | `src/app/forgot-password/forgot-password-form.tsx` |
| Reset password form | `src/app/reset-password/reset-password-form.tsx` |
| OAuth/email callback | `src/app/auth/callback/route.ts` |
| Auth UI wrapper | `src/app/auth/auth-shell.tsx` |
| Error message mapping | `src/app/auth/auth-utils.ts` |
| Dashboard auth guard | `src/app/dashboard/page.tsx` |
| Course page auth guard | `src/app/courses/[slug]/page.tsx` |
| PDF download auth guard | `src/app/api/materials/[pdfId]/download/route.ts` |

---

## 5. Current Database / Schema Summary

### Tables

#### `profiles`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, FK → auth.users(id) ON DELETE CASCADE |
| `full_name` | text | nullable |
| `avatar_url` | text | nullable |
| `account_status` | text | NOT NULL DEFAULT 'active', CHECK IN ('active','suspended') |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

- **Trigger**: `set_profiles_updated_at` → `set_updated_at()` on UPDATE
- **Auto-creation trigger**: `on_auth_user_created` on `auth.users` → `private.handle_new_user()` inserts profile row

#### `courses`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `slug` | text | UNIQUE NOT NULL, CHECK (lowercase + alphanumeric-dash pattern) |
| `name` | text | NOT NULL |
| `display_order` | integer | NOT NULL, CHECK > 0 |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

- **Index**: `courses_active_order_idx` ON (is_active, display_order)
- **Seed data**: IELTS (1), OET (2), PTE (3), German (4)

#### `course_pdfs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `course_id` | uuid | NOT NULL, FK → courses(id) ON DELETE CASCADE |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `r2_object_key` | text | NOT NULL |
| `file_size_bytes` | bigint | nullable, CHECK >= 0 |
| `mime_type` | text | NOT NULL DEFAULT 'application/pdf', CHECK = 'application/pdf' |
| `is_published` | boolean | NOT NULL DEFAULT false |
| `display_order` | integer | NOT NULL DEFAULT 0 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

- **Trigger**: `set_course_pdfs_updated_at` → `set_updated_at()` on UPDATE
- **Index**: `course_pdfs_course_published_order_idx` ON (course_id, is_published, display_order)

#### `questions`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `course_id` | uuid | NOT NULL, FK → courses(id) ON DELETE CASCADE |
| `question_text` | text | NOT NULL |
| `option_a` | text | NOT NULL |
| `option_b` | text | NOT NULL |
| `option_c` | text | NOT NULL |
| `option_d` | text | NOT NULL |
| `correct_option` | text | NOT NULL, CHECK IN ('A','B','C','D') |
| `explanation` | text | nullable |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

- **Trigger**: `set_questions_updated_at` → `set_updated_at()` on UPDATE
- **Index**: `questions_course_active_idx` ON (course_id, is_active)

#### `quiz_attempts`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `course_id` | uuid | NOT NULL, FK → courses(id) ON DELETE RESTRICT |
| `test_size` | integer | NOT NULL, CHECK IN (20, 50, 100) |
| `status` | text | NOT NULL DEFAULT 'in_progress', CHECK IN ('in_progress','submitted','abandoned') |
| `score` | integer | nullable, CHECK >= 0 |
| `percentage` | numeric(5,2) | nullable, CHECK 0–100 |
| `started_at` | timestamptz | NOT NULL DEFAULT now() |
| `submitted_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

- **Constraint**: `quiz_attempts_submitted_status_check` — `submitted_at IS NOT NULL` ↔ `status = 'submitted'`
- **Index**: `quiz_attempts_user_course_created_idx` ON (user_id, course_id, created_at DESC)
- **Index** (migration 2): `quiz_attempts_course_idx` ON (course_id)

#### `quiz_attempt_questions`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `attempt_id` | uuid | NOT NULL, FK → quiz_attempts(id) ON DELETE CASCADE |
| `question_id` | uuid | NOT NULL, FK → questions(id) ON DELETE RESTRICT |
| `question_order` | integer | NOT NULL, CHECK > 0 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

- **Unique**: (attempt_id, question_id), (attempt_id, question_order)
- **Index**: `quiz_attempt_questions_attempt_order_idx` ON (attempt_id, question_order)
- **Index** (migration 2): `quiz_attempt_questions_question_idx` ON (question_id)

#### `student_answers`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `attempt_id` | uuid | NOT NULL, FK → quiz_attempts(id) ON DELETE CASCADE |
| `question_id` | uuid | NOT NULL, FK → questions(id) ON DELETE RESTRICT |
| `selected_option` | text | NOT NULL, CHECK IN ('A','B','C','D') |
| `is_correct` | boolean | nullable |
| `answered_at` | timestamptz | NOT NULL DEFAULT now() |

- **Unique**: (attempt_id, question_id)
- **FK**: (attempt_id, question_id) → quiz_attempt_questions(attempt_id, question_id) ON DELETE CASCADE
- **Index**: `student_answers_attempt_question_idx` ON (attempt_id, question_id)
- **Index** (migration 2): `student_answers_question_idx` ON (question_id)

### Helper Functions

| Function | Purpose |
|----------|---------|
| `public.set_updated_at()` | Trigger function to auto-set `updated_at = now()` |
| `public.is_admin()` | Returns true if JWT `app_metadata.role = 'admin'` — **Supabase-specific** |
| `private.handle_new_user()` | Auto-creates profile row on auth.users INSERT — **Supabase-specific** |

### RLS Policies (Final State After Migration 2)

**Student access**:
- Profiles: owner can SELECT/UPDATE their own row
- Courses: SELECT where `is_active = true`
- Course PDFs: SELECT where `is_published = true` AND course `is_active = true`
- Quiz attempts: SELECT where `user_id = auth.uid()`
- Quiz attempt questions: SELECT via join to owned attempt
- Student answers: SELECT via join to owned attempt
- Questions: **NO student SELECT policy** — answer keys are never exposed to browser

**Admin access** (via `is_admin()` — all tables, all operations):
- Full CRUD on all tables

### What to Preserve vs. Discard

- ✅ **PRESERVE**: All table structures, columns, constraints, indexes, triggers (`set_updated_at`)
- ✅ **PRESERVE**: All business logic (test_size check, status transitions, FK relationships)
- ✅ **PRESERVE**: Authorization rules (translate from RLS to server-side middleware)
- ❌ **DISCARD**: `is_admin()` function (replace with app-level role check)
- ❌ **DISCARD**: `handle_new_user()` trigger (replace with application code)
- ❌ **DISCARD**: All RLS policies (replace with server-side authorization)
- ❌ **DISCARD**: `auth.users` FK references (replace with our own `users` table)

---

## 6. Cloudflare / vinext / R2 Dependency Summary

### Cloudflare Workers / vinext (DEPLOYMENT ONLY — will be replaced by VPS)

| File | Cloudflare Dependency | Impact |
|------|----------------------|--------|
| `vite.config.ts` | `@cloudflare/vite-plugin`, `vinext` plugin | Cloudflare-specific build pipeline |
| `cloudflare.config.ts` | `cf/config` — Worker name, entrypoint, compatibility flags | Cloudflare Worker configuration |
| `package.json` | `@vinext/cloudflare` (dep), `vinext` (devDep), `@cloudflare/vite-plugin` (devDep), `@cloudflare/workers-types` (devDep), `cf` (devDep) | Cloudflare packages |
| `package.json` scripts | `deploy`, `deploy:preview`, `cf:check`, `cf:build`, `cf:preview`, `cf:deploy`, `dev:vinext`, `build:vinext`, `start:vinext`, `deploy:vinext` | Cloudflare deployment commands |
| `tsconfig.json` | `"types": ["@cloudflare/workers-types", …]`, includes `.cloudflare/types/**/*.ts` | Cloudflare type definitions |
| `.dev.vars.example` | Template for Cloudflare Worker dev vars | Cloudflare dev config |
| `DEPLOYMENT.md` | Full Cloudflare Workers deployment docs | Documentation |
| `README.md` | References Cloudflare Workers/vinext deployment | Documentation |

### Cloudflare R2 (FILE STORAGE — decision needed independently)

| File | R2 Dependency | Impact |
|------|---------------|--------|
| `src/lib/r2/client.ts` | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — S3-compatible API | **NOT Cloudflare-specific**. Uses standard S3 SDK. |
| `src/app/api/materials/[pdfId]/download/route.ts` | Calls `createPdfDownloadUrl()` from r2/client.ts | Uses the R2 client to generate signed download URLs |
| `.env.example` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | R2 credentials |

> [!IMPORTANT]
> **The R2 client code (`src/lib/r2/client.ts`) uses the standard AWS S3 SDK**, not Cloudflare-specific bindings. This means it will work with Cloudflare R2 (current), MinIO (self-hosted S3-compatible, for VPS), AWS S3, or any S3-compatible object storage.
>
> **The R2 code does NOT need to be rewritten.** Only the environment variables (endpoint URL, credentials) need to change if you switch storage providers.

---

## 7. Recommended IndiaHost VPS Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        IndiaHost VPS                            │
│                                                                 │
│  ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │      Nginx (reverse      │   │    PostgreSQL 16           │  │
│  │      proxy + SSL)        │   │    (self-hosted)           │  │
│  │                          │   │                             │  │
│  │  - HTTPS termination     │   │  - users table (replaces   │  │
│  │  - gzip / brotli         │   │    auth.users)             │  │
│  │  - rate limiting         │   │  - profiles                │  │
│  │  - static file serving   │   │  - courses                 │  │
│  │  - security headers      │   │  - course_pdfs             │  │
│  └──────────┬───────────────┘   │  - questions               │  │
│             │                    │  - quiz_attempts           │  │
│             ▼                    │  - quiz_attempt_questions  │  │
│  ┌──────────────────────────┐   │  - student_answers         │  │
│  │   Next.js 16 App         │   └───────────────────────────┘  │
│  │   (Node.js standalone)   │              ▲                    │
│  │                          │              │                    │
│  │  - next start (port 3000)│──────────────┘                   │
│  │  - Server Components     │   direct TCP (localhost:5432)     │
│  │  - API Routes            │                                   │
│  │  - Custom auth middleware│   ┌───────────────────────────┐  │
│  │  - Session cookies       │   │  File Storage (one of):   │  │
│  │                          │──▶│  Option A: Local disk +   │  │
│  └──────────────────────────┘   │    signed paths           │  │
│                                  │  Option B: MinIO (S3 API) │  │
│                                  │  Option C: Keep R2 remote │  │
│                                  └───────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────┐                                   │
│  │  Automated Backups       │                                   │
│  │  - pg_dump daily cron    │                                   │
│  │  - Offsite backup copy   │                                   │
│  └──────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Web server** | Nginx reverse proxy → Next.js standalone | Industry standard, handles SSL/compression/rate-limiting outside Node |
| **Application** | Next.js standalone mode (`next build` + `next start`) | No vinext/Cloudflare needed. Standard Node.js deployment. |
| **Database** | Self-hosted PostgreSQL 16 | Same engine as Supabase's underlying DB. Zero migration cost for schema. |
| **ORM/Query layer** | Drizzle ORM | Type-safe, lightweight, excellent PostgreSQL support, minimal overhead |
| **Authentication** | Custom JWT sessions in HTTP-only cookies | Full control, no external dependency, production-proven pattern |
| **File storage** | Keep Cloudflare R2 OR self-host MinIO | R2 code already uses S3 SDK — works with either. R2 is cheap and doesn't require VPS disk. |
| **Process manager** | PM2 or systemd | Auto-restart, log management |
| **SSL** | Let's Encrypt via Certbot | Free, auto-renewing |
| **Backups** | pg_dump daily + offsite copy | Simple, reliable |

### Why This Architecture Is Appropriate

- **Simple**: Two processes (Nginx + Next.js) plus one database — no microservices
- **Secure**: All DB access through server-side code; no browser→DB connection
- **Inexpensive**: Single VPS, free SSL, free PostgreSQL, no third-party SaaS
- **Maintainable**: Standard tools any developer knows
- **Scalable**: PostgreSQL handles thousands of concurrent students easily
- **Backupable**: pg_dump + rsync covers everything

---

## 8. Recommended Database Approach

### Use Self-Hosted PostgreSQL 16

Your entire schema is already PostgreSQL. Supabase is just a managed PostgreSQL under the hood. Migrating tables, indexes, constraints, and triggers requires zero schema changes.

### Schema Changes Required

**1. Replace `auth.users` with our own `users` table:**

```sql
CREATE TABLE public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name     text,
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  is_active     boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**2. Update FK references:**
- `profiles.id` → references `public.users(id)` instead of `auth.users(id)`
- `quiz_attempts.user_id` → references `public.users(id)` instead of `auth.users(id)`

**3. Simplify `profiles`**: With our own `users` table, `full_name` and `avatar_url` can live directly in `users`. The `profiles` table can be retained for additional student-specific data or merged into `users`.

**4. Remove Supabase-specific functions:**
- Drop `is_admin()` (replaced by `user.role = 'admin'` check in application code)
- Drop `handle_new_user()` trigger (profile creation done in signup handler)
- Drop all RLS policies (authorization moves to application layer)

**5. Keep everything else**: All other tables, columns, constraints, indexes, and the `set_updated_at()` trigger function are pure PostgreSQL and carry over unchanged.

### Query Layer: Drizzle ORM

Drizzle is recommended because:
- Type-safe schema definitions that mirror your existing tables
- Lightweight (no heavy runtime)
- Native PostgreSQL support
- Works perfectly with Next.js Server Components and API routes
- Easy migration tooling (`drizzle-kit`)

---

## 9. Recommended Authentication / Session Approach

### Architecture: Stateless JWT in HTTP-Only Cookies

```
Login Request (email + password)
        │
        ▼
Server API Route (/api/auth/login)
        │
        ├─ 1. Query users table for email
        ├─ 2. bcrypt.compare(password, password_hash)
        ├─ 3. If valid → sign JWT { userId, role, email }
        ├─ 4. Set HTTP-only, Secure, SameSite=Lax cookie
        └─ 5. Return success
```

### Implementation Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Password hashing | `bcrypt` (via `bcryptjs`) | Hash + verify passwords |
| JWT signing/verification | `jose` (lightweight, Edge-compatible) | Create + validate session tokens |
| Cookie management | Next.js `cookies()` API | Set/read HTTP-only session cookies |
| Middleware auth guard | `src/middleware.ts` (replacing proxy.ts) | Verify JWT on protected routes, redirect if invalid |

### API Routes to Implement

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Validate credentials, set session cookie |
| `/api/auth/signup` | POST | Create user + profile, set session cookie |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/auth/forgot-password` | POST | Generate reset token, send email |
| `/api/auth/reset-password` | POST | Validate token, update password hash |
| `/api/auth/me` | GET | Return current user from session (for client) |

### Session Cookie Specification

```
Name:     aylem_session
Value:    <signed JWT>
HttpOnly: true        ← prevents XSS from reading token
Secure:   true        ← HTTPS only in production
SameSite: Lax         ← CSRF protection
Path:     /           ← available on all routes
MaxAge:   7 days      ← auto-expiry
```

### JWT Payload

```json
{
  "sub": "uuid-user-id",
  "email": "student@example.com",
  "role": "student",
  "iat": 1727740000,
  "exp": 1728344800
}
```

### Auth Helper Module (replacing src/lib/supabase/)

```
src/lib/auth/
  ├── session.ts       ← JWT sign/verify, cookie get/set/clear
  ├── password.ts      ← bcrypt hash/compare
  ├── middleware.ts     ← getSessionUser() for Server Components + API routes
  └── guard.ts         ← requireUser() / requireAdmin() helpers
```

### Google OAuth (Deferred to Later Phase)

Google OAuth can be implemented directly using Google's OAuth 2.0 endpoints without any Supabase dependency. The callback route would verify the Google token, find-or-create the user, and set the same session cookie.

---

## 10. Security Considerations

### Authentication & Sessions

| Concern | Mitigation |
|---------|------------|
| Password storage | bcrypt with cost factor >= 12 — never plaintext |
| Session tokens | Signed JWT with server-only secret (HS256) |
| Cookie security | HttpOnly (no JS access), Secure (HTTPS only), SameSite=Lax |
| Token expiry | 7-day max-age; refresh on activity if needed |
| Brute force | Rate limiting at Nginx level (limit_req) |
| CSRF | SameSite=Lax cookies + verify Origin header on mutations |

### Authorization

| Concern | Mitigation |
|---------|------------|
| Route protection | Middleware validates JWT before any protected route renders |
| Data isolation | All DB queries include `WHERE user_id = ?` — server-enforced |
| Quiz answer keys | Questions table is NEVER queried from browser-facing code. Server-side only. |
| Admin functions | `requireAdmin()` guard checks `user.role === 'admin'` server-side |
| PDF access | Download route verifies session before generating signed URL |
| Profile access | Users can only read/update their own profile — enforced in API |

### Infrastructure

| Concern | Mitigation |
|---------|------------|
| SQL injection | Parameterized queries via Drizzle ORM (never raw string concat) |
| XSS | React auto-escapes output; HttpOnly cookies prevent token theft |
| HTTPS | Let's Encrypt + Nginx enforces HTTPS redirect |
| Database exposure | PostgreSQL listens on localhost only — no external access |
| Secrets management | Environment variables on server; never committed; never in NEXT_PUBLIC_ |
| Input validation | Server-side validation on all API routes (email format, password length, UUID format) |
| File upload safety | Existing R2 client already validates file type, size, and object key path |

### Comparison: Current RLS vs. Proposed Server-Side Auth

| What RLS Did | What Server-Side Code Will Do |
|-------------|-------------------------------|
| `auth.uid() = user_id` on SELECT | `WHERE user_id = session.userId` in every query |
| `is_admin()` on admin operations | `requireAdmin()` middleware before any admin handler |
| No student SELECT on questions | Questions never queried in student-facing routes |
| Published-only PDFs for students | `WHERE is_published = true` enforced in query |

> [!IMPORTANT]
> With Supabase RLS removed, **the application server becomes the sole authorization boundary**. Every API route and Server Component that accesses data must explicitly check permissions. This is the standard pattern for every non-Supabase web application and is equally secure when implemented correctly — it is how Rails, Django, Express, and most production systems work.

---

## 11. Exact Migration Sequence

### Phase 1 — Step 2: Infrastructure Replacement (NEXT)

```
Step 2a: Install replacement dependencies
         - Add: drizzle-orm, drizzle-kit, pg (postgres driver), bcryptjs, jose
         - Remove: @supabase/ssr, @supabase/supabase-js
         - Remove: @vinext/cloudflare, vinext, @cloudflare/vite-plugin,
                   @cloudflare/workers-types, cf
         - Keep: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner (for file storage)

Step 2b: Create self-hosted database schema
         - Write new migration: create users table
         - Adapt existing tables (update FK references)
         - Remove RLS policies, Supabase functions
         - Keep all business constraints/indexes/triggers
         - Configure Drizzle schema definitions

Step 2c: Build auth module (src/lib/auth/)
         - session.ts: JWT sign/verify/cookie management
         - password.ts: bcrypt hash/compare
         - middleware.ts: getSessionUser() for server code
         - guard.ts: requireUser(), requireAdmin()

Step 2d: Replace middleware
         - Rewrite src/proxy.ts (or rename to src/middleware.ts)
         - Check JWT cookie instead of Supabase session
         - Same redirect logic for unauthenticated users

Step 2e: Create auth API routes
         - /api/auth/login (replaces browser Supabase signIn)
         - /api/auth/signup (replaces browser Supabase signUp)
         - /api/auth/logout (replaces browser Supabase signOut)
         - /api/auth/forgot-password (email sending — may defer)
         - /api/auth/reset-password (token validation + password update)

Step 2f: Rewrite auth form components
         - login-form.tsx: POST to /api/auth/login instead of supabase.auth
         - signup-form.tsx: POST to /api/auth/signup instead of supabase.auth
         - logout/page.tsx: POST to /api/auth/logout
         - forgot-password-form.tsx: POST to /api/auth/forgot-password
         - reset-password-form.tsx: POST to /api/auth/reset-password

Step 2g: Replace server-side auth checks
         - dashboard/page.tsx: use getSessionUser() instead of supabase.auth.getUser()
         - courses/[slug]/page.tsx: same
         - api/materials/[pdfId]/download/route.ts: same

Step 2h: Replace database queries
         - materials.ts: use Drizzle query instead of supabase.from("course_pdfs")
         - api/materials/[pdfId]/download/route.ts: use Drizzle instead of adminSupabase

Step 2i: Update auth callback
         - Rewrite or remove /auth/callback (depends on OAuth implementation)

Step 2j: Clean up
         - Delete src/lib/supabase/ directory
         - Delete supabase/ directory (keep schema as reference doc if desired)
         - Update environment variables (.env files)
         - Update README.md, DEPLOYMENT.md
         - Remove Cloudflare configs (vite.config.ts, cloudflare.config.ts)
         - Update tsconfig.json (remove @cloudflare/workers-types)
         - Update package.json scripts (remove cf:* and vinext scripts)
         - Update text strings that mention "Supabase"
```

### Phase 1 — Step 3: VPS Deployment Setup

```
Step 3a: Configure Next.js for standalone output
Step 3b: Set up PostgreSQL on VPS
Step 3c: Run database migrations
Step 3d: Configure Nginx reverse proxy
Step 3e: Set up SSL (Let's Encrypt)
Step 3f: Configure PM2 / systemd for process management
Step 3g: Set up automated backups (pg_dump cron)
Step 3h: Deploy and verify
```

---

## 12. Files That Will Need Modification

### Files to REWRITE (major changes)

| File | Change |
|------|--------|
| `src/proxy.ts` | Replace Supabase session check with JWT cookie check |
| `src/app/login/login-form.tsx` | POST to /api/auth/login instead of Supabase SDK |
| `src/app/signup/signup-form.tsx` | POST to /api/auth/signup instead of Supabase SDK |
| `src/app/logout/page.tsx` | POST to /api/auth/logout instead of Supabase SDK |
| `src/app/forgot-password/forgot-password-form.tsx` | POST to /api/auth/forgot-password |
| `src/app/reset-password/reset-password-form.tsx` | POST to /api/auth/reset-password |
| `src/app/auth/callback/route.ts` | Rewrite for custom OAuth/email-verify flow |
| `src/app/dashboard/page.tsx` | Replace supabase.auth.getUser() with getSessionUser() |
| `src/app/courses/[slug]/page.tsx` | Replace supabase.auth.getUser() with getSessionUser() |
| `src/app/api/materials/[pdfId]/download/route.ts` | Replace both Supabase clients with custom auth + Drizzle |
| `src/lib/materials.ts` | Replace Supabase query with Drizzle query |
| `src/app/auth/auth-utils.ts` | Update getAuthRedirectUrl(); toAuthMessage() is mostly portable |
| `package.json` | Remove Supabase/Cloudflare deps, add new deps, update scripts |
| `tsconfig.json` | Remove @cloudflare/workers-types, .cloudflare types |

### Files to DELETE

| File | Reason |
|------|--------|
| `src/lib/supabase/browser.ts` | Supabase browser client — replaced by API calls |
| `src/lib/supabase/server.ts` | Supabase server client — replaced by Drizzle + auth module |
| `src/lib/supabase/admin.ts` | Supabase admin client — replaced by Drizzle |
| `src/lib/supabase/proxy.ts` | Supabase middleware — replaced by custom middleware |
| `vite.config.ts` | Cloudflare/vinext build config — not needed for VPS |
| `cloudflare.config.ts` | Cloudflare Worker config — not needed for VPS |
| `.dev.vars.example` | Cloudflare dev vars template |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/auth/session.ts` | JWT sign/verify, cookie management |
| `src/lib/auth/password.ts` | bcrypt hash/compare |
| `src/lib/auth/middleware.ts` | getSessionUser(), requireUser() |
| `src/lib/auth/guard.ts` | Authorization helpers |
| `src/lib/db/index.ts` | Drizzle client + connection pool |
| `src/lib/db/schema.ts` | Drizzle schema definitions |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/signup/route.ts` | Signup endpoint |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/forgot-password/route.ts` | Password reset request |
| `src/app/api/auth/reset-password/route.ts` | Password reset execution |
| `migrations/001_initial_schema.sql` | Self-hosted PostgreSQL schema |

### Files to UPDATE (minor text changes)

| File | Change |
|------|--------|
| `src/app/forgot-password/page.tsx` | Update subtitle text (remove "Supabase") |
| `src/app/dashboard/dashboard-content.tsx` | Update Toast text (remove "Supabase") |
| `src/app/profile/page.tsx` | Update placeholder text (remove "Supabase") |
| `src/app/results/page.tsx` | Update placeholder text (remove "Supabase") |
| `.env.example` | Remove Supabase vars, add DATABASE_URL + JWT_SECRET |
| `.env.local.example` | Same |
| `.env.local` | Replace with new credentials |
| `README.md` | Rewrite for VPS deployment |
| `DEPLOYMENT.md` | Rewrite for VPS deployment |

---

## 13. Files That Can Remain Unchanged

| File | Why It's Safe |
|------|---------------|
| `src/app/layout.tsx` | No Supabase dependency |
| `src/app/page.tsx` | Just redirects to /dashboard |
| `src/app/not-found.tsx` | Pure UI |
| `src/components/app-shell.tsx` | Pure UI + routing (no auth dependency) |
| `src/components/ui/*` (all 9 files) | Pure UI components — zero Supabase dependency |
| `src/lib/courses.ts` | Static course registry — no Supabase |
| `src/lib/design.ts` | Color constants + cn() utility |
| `src/lib/format.ts` | File size formatter |
| `src/lib/quiz.ts` | Quiz selection/shuffle logic — no Supabase |
| `src/lib/quiz.test.ts` | Pure unit test — no Supabase |
| `src/lib/types.ts` | Type definitions — no Supabase |
| `src/lib/r2/client.ts` | S3-compatible client — works without Cloudflare |
| `src/app/courses/[slug]/materials-list.tsx` | Client component — calls /api/materials/* (no direct Supabase) |
| `src/app/courses/[slug]/quiz/page.tsx` | Pure UI — no Supabase dependency |
| `src/app/auth/auth-shell.tsx` | Pure UI wrapper |
| `src/app/support/page.tsx` | Pure UI placeholder |
| `src/app/thank-you/page.tsx` | Pure UI |
| `src/app/login/page.tsx` | Wrapper — just renders AuthShell + LoginForm |
| `src/app/signup/page.tsx` | Wrapper — just renders AuthShell + SignupForm |
| `src/app/reset-password/page.tsx` | Wrapper — just renders AuthShell + ResetPasswordForm |
| `src/app/api/pdfs/[id]/route.ts` | Just a 308 redirect — no Supabase |
| `src/app/globals.css` | Pure CSS — no Supabase |
| `next.config.ts` | Minimal config — no Supabase |
| `vitest.config.ts` | Test config — no Supabase |
| `vitest.setup.ts` | Test setup — no Supabase |
| `eslint.config.mjs` | Lint config |
| `.prettierrc.json` | Format config |
| `.prettierignore` | Format ignore |
| `.gitignore` | Git ignore |

**Total: ~28 files can remain completely untouched.**

---

## 14. Risks and Compatibility Problems

### High Risk

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Email delivery for password reset** | Supabase currently handles sending reset emails. On VPS, we need our own email service. | Use a transactional email service (Resend, Postmark, or SMTP). Defer if not critical for initial launch. |
| **Google OAuth redirect URIs** | Currently configured in Supabase dashboard. Must be reconfigured for our own callback URL. | Update Google Cloud Console OAuth settings when implementing. |
| **Email verification flow** | Supabase handles magic-link email verification. Replacement requires sending verification emails. | Can be deferred; initially allow login without email verification if needed. |

### Medium Risk

| Risk | Detail | Mitigation |
|------|--------|------------|
| **middleware.ts vs proxy.ts naming** | Next.js 16 may use `proxy.ts` as the middleware filename (based on current code). Verify the correct convention. | Check Next.js 16 docs for the middleware entry point filename before renaming. |
| **Existing Supabase user data** | If there are real users in the Supabase project, their data needs migration. | Export users from Supabase, import into new users table. Password hashes can be migrated if Supabase uses bcrypt (it does). |
| **R2 bucket access from VPS** | R2 is currently accessed via S3 API. From an Indian VPS, latency to Cloudflare R2 may be higher than from a Cloudflare Worker. | Acceptable for PDF downloads (infrequent, large files). Consider MinIO on VPS if latency is a problem. |
| **Next.js standalone build size** | Standalone output includes Node.js server. May need `output: "standalone"` in next.config.ts. | Add `output: "standalone"` to next.config.ts for VPS deployment. |

### Low Risk

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Drizzle learning curve** | New ORM for the project. | Drizzle is minimal and well-documented; schema mapping is straightforward. |
| **bcrypt on Node.js** | bcryptjs is pure JS. For performance, could use native bcrypt. | bcryptjs is fine for thousands of users. Switch to native bcrypt if needed later. |
| **JWT secret rotation** | Changing the JWT secret invalidates all sessions. | Use a stable secret in production; plan rotation strategy if needed. |

### Discovered Issues

1. **`.env.local` contains a live Supabase URL and publishable key** — this file is in the repo and should be reviewed for gitignore coverage.
2. **The `Skeleton` component is imported in `results/page.tsx`** and exported from `loading.tsx` — confirmed working but worth noting.
3. **Quiz page is purely a UI preview** — no actual quiz-taking logic is wired. The quiz UI shows static placeholder options.
4. **Profile and Results pages are scaffold placeholders** — they contain no functional logic, only UI layouts with placeholder messages.

---

## 15. Proposed Phase 1 — Step 2 Implementation Plan

### Execution Order

```
  PHASE 1, STEP 2: REPLACE SUPABASE + CLOUDFLARE DEPLOYMENT

  2.1  Install new dependencies                           ~10min
       └─ drizzle-orm, drizzle-kit, pg, bcryptjs, jose

  2.2  Remove Supabase + Cloudflare packages              ~5min
       └─ @supabase/ssr, @supabase/supabase-js,
          @vinext/cloudflare, vinext, @cloudflare/vite-plugin,
          @cloudflare/workers-types, cf

  2.3  Create database schema + Drizzle config            ~30min
       └─ users table, adapted FKs, Drizzle schema file,
          connection pool, migration SQL

  2.4  Build auth module (src/lib/auth/)                  ~45min
       └─ session.ts, password.ts, middleware.ts, guard.ts

  2.5  Create auth API routes                             ~30min
       └─ /api/auth/login, signup, logout,
          forgot-password, reset-password

  2.6  Rewrite middleware (proxy.ts → middleware.ts)       ~15min
       └─ JWT cookie check, redirect logic

  2.7  Rewrite auth form components                       ~30min
       └─ login-form, signup-form, logout, forgot-pwd,
          reset-pwd → all POST to our API routes

  2.8  Replace server-side auth + DB queries              ~20min
       └─ dashboard/page.tsx, courses/[slug]/page.tsx,
          materials.ts, download/route.ts

  2.9  Clean up and update configs                        ~20min
       └─ Delete Supabase dir, Cloudflare configs,
          update env files, tsconfig, package.json scripts,
          update UI text mentioning Supabase

  2.10 Update documentation                              ~15min
       └─ README.md, DEPLOYMENT.md for VPS

  2.11 Verify                                             ~15min
       └─ Run typecheck, lint, existing tests,
          manual smoke test of auth + course pages
```

### Deliverables for Step 2

1. All Supabase packages removed from package.json
2. All Cloudflare/vinext packages removed from package.json
3. New `src/lib/auth/` module with JWT session management
4. New `src/lib/db/` module with Drizzle ORM + PostgreSQL connection
5. New auth API routes replacing Supabase client-side auth
6. All auth forms rewritten to use our API routes
7. All server-side auth checks using our session module
8. All DB queries using Drizzle instead of Supabase client
9. Middleware rewritten for JWT cookie validation
10. Self-hosted PostgreSQL migration SQL ready
11. Environment variable templates updated
12. Documentation updated for VPS deployment
13. Application builds and type-checks successfully
14. Existing tests still pass

### What Step 2 Does NOT Include

- VPS server setup (that's Step 3)
- Nginx configuration (Step 3)
- SSL setup (Step 3)
- Production deployment (Step 3)
- Payment/Cashfree integration (future phase)
- Admin panel (future phase)
- Google OAuth implementation (can be deferred)
- Email sending service integration (can be stubbed initially)

---

> **This audit is complete. No code has been modified. Awaiting your approval to proceed with Phase 1 — Step 2.**
