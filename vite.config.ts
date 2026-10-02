import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

const cloudflareRuntimeWorkerPath = fileURLToPath(
  new URL("./src/lib/cloudflare/runtime.worker.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@/lib/cloudflare/runtime",
        replacement: cloudflareRuntimeWorkerPath,
      },
    ],
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
