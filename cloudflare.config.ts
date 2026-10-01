import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "aylem-learning-student-portal",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      NODE_ENV: bindings.text("production"),
      ALLOW_PUBLIC_SIGNUP: bindings.text("false"),
      HYPERDRIVE: bindings.hyperdrive({
        id: process.env.CLOUDFLARE_HYPERDRIVE_ID || "00000000-0000-0000-0000-000000000000",
        dev: {
          connectionString: process.env.DATABASE_URL,
        },
      }),
      MATERIALS_BUCKET: bindings.r2({
        name: process.env.CLOUDFLARE_R2_BUCKET_NAME || "aylem-portal-materials",
      }),
      AUTH_RATE_LIMITER: bindings.rateLimit({
        namespace: process.env.CLOUDFLARE_AUTH_RATE_LIMIT_NAMESPACE || "1001",
        simple: {
          limit: 10,
          period: 60,
        },
      }),
    },
  }),
});
