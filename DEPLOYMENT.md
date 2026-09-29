# Cloudflare Workers Deployment

This project is configured for Cloudflare Workers with vinext, not Cloudflare Pages and not OpenNext.

## Required Cloudflare build settings

In Cloudflare Workers > the Worker > Settings > Builds, use:

- Build command: leave empty
- Deploy command: `bun run deploy`
- Preview command: `bun run deploy:preview`
- Root directory: project root

Do not use the default deploy command `npx wrangler deploy` for this repository. If Wrangler runs without the vinext deploy command, it may auto-detect the app as Next.js/OpenNext and try to run an OpenNext migration.

The Worker name is configured in `cloudflare.config.ts` as `aylem-spgg`. Do not pass `--name` to `vinext-cloudflare deploy` for this typed config setup.

## Runtime requirements

- Node.js: `22.12+`
- Bun: `1.4+`

## Required Worker environment variables

Configure these in Cloudflare as environment variables/secrets. Do not commit real values.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
```

## Local checks

```bash
bun run lint
bun run typecheck
bun run build
bun run cf:check
bun run cf:build
```

`cf:check` and `cf:build` require Node `22.12+`.
