# Archived Supabase Migrations

> **Status: ARCHIVED / INACTIVE**

These SQL files represent the historical database migrations from the initial Supabase-backed architecture.
As part of Phase 1 — Step 4 of the VPS migration, all database schemas have been consolidated into **Drizzle ORM** (`src/lib/db/schema.ts` and `drizzle/`).

**DO NOT execute these migrations.** Use the Drizzle migration system:
```bash
bun run db:generate
bun run db:migrate
bun run db:seed
```
