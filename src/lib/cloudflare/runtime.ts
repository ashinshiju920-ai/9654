import "server-only";

export type HyperdriveBinding = {
  connectionString: string;
};

export type RateLimitBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type R2ObjectBody = {
  body: ReadableStream;
  httpEtag?: string;
  size?: number;
  writeHttpMetadata(headers: Headers): void;
};

export type R2BucketBinding = {
  get(key: string): Promise<R2ObjectBody | null>;
};

export type CloudflareWorkerEnv = {
  HYPERDRIVE?: HyperdriveBinding;
  MATERIALS_BUCKET?: R2BucketBinding;
  AUTH_RATE_LIMITER?: RateLimitBinding;
  ALLOW_PUBLIC_SIGNUP?: string;
  NODE_ENV?: string;
};

let cachedCloudflareEnv: Promise<CloudflareWorkerEnv | null> | null = null;

export async function getCloudflareEnv(): Promise<CloudflareWorkerEnv | null> {
  cachedCloudflareEnv ??= loadCloudflareEnv();
  return cachedCloudflareEnv;
}

export async function getRuntimeEnvValue(name: string): Promise<string | undefined> {
  const cloudflareEnv = await getCloudflareEnv();
  const bindingValue = cloudflareEnv?.[name as keyof CloudflareWorkerEnv];

  if (typeof bindingValue === "string") {
    return bindingValue;
  }

  return process.env[name];
}

export async function isProductionRuntime(): Promise<boolean> {
  return (await getRuntimeEnvValue("NODE_ENV")) === "production";
}

async function loadCloudflareEnv(): Promise<CloudflareWorkerEnv | null> {
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{ env?: CloudflareWorkerEnv }>;
    const runtime = await dynamicImport("cloudflare:workers");
    return runtime.env ?? null;
  } catch {
    return null;
  }
}
