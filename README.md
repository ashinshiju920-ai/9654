# Aylem Learning Student Portal

Standalone student portal for Aylem Learning, deployed on a self-hosted Linux VPS (IndiaHost).

> **Architecture Status**: Built entirely on self-hosted PostgreSQL + Drizzle ORM + secure database-backed session authentication. Supabase has been permanently removed from the application.

---

## Target Architecture

```
Student Browser
      │
      ▼
    Nginx (Reverse Proxy & SSL Termination)
      │
      ▼
Next.js 16 Application Server (Node.js runtime, single VPS)
      │
      ├─ Proxy / Middleware: Edge-level cookie validation (`aylem_session`)
      ├─ Server Components & APIs: Cryptographic session lookup & RBAC
      ├─ Password Security: Built-in scrypt (N=16384, r=8, p=1) with 32-byte salt
      ├─ Cloudflare R2: S3-compatible private PDF storage with signed URLs
      │
      ▼
PostgreSQL (Local / Self-hosted database)
      ├─ users
      ├─ sessions (opaque SHA-256 hashed tokens)
      ├─ password_reset_tokens
      ├─ courses
      ├─ course_pdfs
      ├─ questions
      ├─ quiz_attempts
      ├─ quiz_attempt_questions
      └─ student_answers
```

---

## Security & Session Architecture

- **Session Tokens**: 256-bit cryptographically secure random entropy stored in an `HttpOnly`, `SameSite=Lax` cookie (`aylem_session`).
- **Database Storage**: The database only stores SHA-256 hashes of session tokens.
- **Account Status**: Every authenticated request verifies `account_status === 'active'`. Suspended or disabled accounts cannot access protected content.
- **Role-Based Access**: Role validation (`student`, `admin`) is performed server-side via `requireUser()` and `requireAdmin()`.
- **Question & Answer Protection**: Quiz questions sent to students are strictly sanitized—answer keys and explanations remain server-side.
- **PDF Access Protection**: Materials are delivered via short-lived signed URLs generated only after verifying authenticated student status.
- **Rate Limiting**: In-memory sliding-window rate limiting on login attempts (10 attempts per 15-minute window per IP).

---

## Environment Variables

Copy `.env.example` to `.env.local` for development:

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://aylem:aylem@localhost:5432/aylem

# Public Signup Configuration (disabled by default in production)
ALLOW_PUBLIC_SIGNUP=true

# Private Storage (Cloudflare R2 / S3-compatible)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=

# Development Test Credentials (optional overrides for db:seed)
DEV_STUDENT_EMAIL=student@aylem.test
DEV_STUDENT_PASSWORD=StudentPass123!
DEV_ADMIN_EMAIL=admin@aylem.test
DEV_ADMIN_PASSWORD=AdminPass123!
```

---

## Database Management & Migrations

Drizzle ORM manages the PostgreSQL schema:

```bash
# Generate SQL migrations from schema definitions
bun run db:generate

# Apply migrations to the database
bun run db:migrate

# Seed development database (1 student, 1 admin, 4 courses, sample materials, sample questions)
bun run db:seed
```

---

## Quality & Verification Commands

```bash
# Run test suite (Vitest)
bun run test

# Run TypeScript typecheck
bun run typecheck

# Run ESLint
bun run lint

# Production build (Next.js)
bun run build
```

---

## Development Test Accounts

When running `bun run db:seed`, the following accounts are provisioned:

| Role | Email | Default Password |
|------|-------|------------------|
| **Student** | `student@aylem.test` | `StudentPass123!` |
| **Admin** | `admin@aylem.test` | `AdminPass123!` |

*(Seeding is blocked automatically if `NODE_ENV === "production"` unless `ALLOW_PRODUCTION_SEED=true` is explicitly set).*
