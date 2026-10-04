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
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    }
  ): Promise<unknown>;
  delete(key: string | string[]): Promise<unknown>;
};

export type CloudflareWorkerEnv = {
  HYPERDRIVE?: HyperdriveBinding;
  MATERIALS_BUCKET?: R2BucketBinding;
  AUTH_RATE_LIMITER?: RateLimitBinding;
  ALLOW_PUBLIC_SIGNUP?: string;
  APP_BASE_URL?: string;
  CASHFREE_ENVIRONMENT?: string;
  CASHFREE_CLIENT_ID?: string;
  CASHFREE_CLIENT_SECRET?: string;
  CASHFREE_API_VERSION?: string;
  MAIN_SITE_INTEGRATION_SECRET?: string;
  MAIN_SITE_PRODUCT_COURSE_MAP?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
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
    const cloudflareWorkersSpecifier = "cloudflare:workers";
    const runtime = (await import(
      /* @vite-ignore */ cloudflareWorkersSpecifier
    )) as { env?: CloudflareWorkerEnv };
    return runtime.env ?? null;
  } catch {
    return null;
  }
}
