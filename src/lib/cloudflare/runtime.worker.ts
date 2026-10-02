import "server-only";

import { env } from "cloudflare:workers";

import type { CloudflareWorkerEnv } from "@/lib/cloudflare/runtime";

export async function getCloudflareEnv(): Promise<CloudflareWorkerEnv> {
  return env as CloudflareWorkerEnv;
}

export async function getRuntimeEnvValue(name: string): Promise<string | undefined> {
  const bindingValue = (env as CloudflareWorkerEnv)[name as keyof CloudflareWorkerEnv];

  if (typeof bindingValue === "string") {
    return bindingValue;
  }

  return process.env[name];
}

export async function isProductionRuntime(): Promise<boolean> {
  return (await getRuntimeEnvValue("NODE_ENV")) === "production";
}
