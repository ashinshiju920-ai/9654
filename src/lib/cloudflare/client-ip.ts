import "server-only";

import { getCloudflareEnv } from "./runtime";

export async function getTrustedClientIdentity(request: Request): Promise<string> {
  const cloudflareEnv = await getCloudflareEnv();

  if (cloudflareEnv) {
    const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
    return connectingIp || "cloudflare-unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "local-development";
}
