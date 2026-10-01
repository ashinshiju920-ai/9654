# Cloudflare Workers Runtime Notes

Step 6B adds a non-destructive Cloudflare Workers runtime path for the student portal.

The normal Next.js workflow remains available:

```bash
bun run dev
bun run build
```

The Cloudflare/vinext workflow is separate:

```bash
bun run dev:vinext
bun run build:vinext
bun run start:vinext
```

Do not run `bun run deploy:vinext` until the production Cloudflare account, Hyperdrive, R2 bucket, secrets, preview testing, DNS plan, and rollout approval are ready.

## Bindings

`cloudflare.config.ts` declares these production bindings:

- `HYPERDRIVE`: Cloudflare Hyperdrive connection to the external PostgreSQL database.
- `MATERIALS_BUCKET`: private Cloudflare R2 bucket for PDF materials.
- `AUTH_RATE_LIMITER`: Cloudflare Rate Limiting binding for login, password reset, and future OTP endpoints.
- `ALLOW_PUBLIC_SIGNUP=false`: production registration policy.
- `NODE_ENV=production`: production cookie/security behavior.

The placeholder Hyperdrive ID and R2 bucket name must be replaced with real Cloudflare resources before deployment. No production secrets belong in Git.

## Database

Application queries continue to use Drizzle and the existing PostgreSQL schema. Runtime code calls `getDb()`:

- Cloudflare Workers: uses `env.HYPERDRIVE.connectionString`.
- Local/Node: uses `DATABASE_URL`.

Drizzle migrations remain CLI-driven and use `drizzle.config.ts`.

## Authentication

Opaque session tokens, hashed session storage, `HttpOnly` cookies, production `Secure` cookies, `SameSite=Lax`, status validation, and RBAC are preserved.

Password hashing remains scrypt with the existing stored hash format. Runtime login/signup/reset paths now use asynchronous scrypt wrappers to avoid synchronous isolate blocking. This does not weaken password security and does not invalidate existing password hashes.

Workers Free CPU limits may still be too tight for scrypt-heavy auth endpoints. Before production, measure login/reset/signup in a real Cloudflare preview. If CPU limits are exceeded, use Workers Paid CPU limits or move to the planned Resend-based OTP/passwordless architecture. Do not lower scrypt parameters as a shortcut.

## Rate Limiting

Production Workers use the `AUTH_RATE_LIMITER` binding. The local in-memory limiter remains only as a development/test fallback when no Cloudflare runtime exists.

The Cloudflare binding is per configured key and per Cloudflare location. It is suitable as a lightweight first layer, but high-risk launch traffic may still need WAF/rate limiting rules or a database/Durable Object backed global counter.

## R2 Materials

Cloudflare Workers use the native `MATERIALS_BUCKET` R2 binding and stream PDFs only after application-level authentication and material authorization.

The old AWS SDK signed URL path remains as a local/non-Workers fallback. The R2 bucket must stay private.

## VPS Files

The VPS files under `deploy/` and `docs/vps-*` are fallback/historical deployment artifacts. They are not the current target for Step 6B.
