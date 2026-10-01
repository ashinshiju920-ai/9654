import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "aylem-portal-preview",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      NODE_ENV: bindings.text("production"),
      ALLOW_PUBLIC_SIGNUP: bindings.text("false"),
      HYPERDRIVE: bindings.hyperdrive({
        id: "569e5215cc774a4b8df2c054877f498f",
        dev: {
          connectionString: process.env.DATABASE_URL,
        },
      }),
      MATERIALS_BUCKET: bindings.r2({
        name: process.env.CLOUDFLARE_R2_BUCKET_NAME || "aylem-portal-preview-materials",
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
