import "server-only";

import { getCloudflareEnv } from "@/lib/cloudflare/runtime";
import type { CourseSlug } from "@/lib/courses";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 180;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PDF_MIME_TYPE = "application/pdf";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const endpoint =
    process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    throw new Error("R2 is not configured.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint };
}

export async function createR2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const config = getR2Config();

  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: "auto",
  });
}

export async function createPdfDownloadUrl(objectKey: string, fileName: string) {
  assertSafeR2ObjectKey(objectKey);

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const config = getR2Config();
  const client = await createR2Client();
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${sanitizeDownloadFileName(fileName)}"`,
    ResponseContentType: PDF_MIME_TYPE,
  });

  return getSignedUrl(client, command, { expiresIn: DEFAULT_SIGNED_URL_TTL_SECONDS });
}

export async function createPdfDownloadResponse(objectKey: string, fileName: string) {
  assertSafeR2ObjectKey(objectKey);

  const cloudflareEnv = await getCloudflareEnv();
  const bucket = cloudflareEnv?.MATERIALS_BUCKET;

  if (bucket) {
    const object = await bucket.get(objectKey);

    if (!object) {
      throw new Error("PDF object not found.");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", PDF_MIME_TYPE);
    headers.set("Content-Disposition", `attachment; filename="${sanitizeDownloadFileName(fileName)}"`);
    headers.set("Cache-Control", "private, no-store");

    if (object.httpEtag) {
      headers.set("ETag", object.httpEtag);
    }

    if (typeof object.size === "number") {
      headers.set("Content-Length", String(object.size));
    }

    return new Response(object.body, { headers });
  }

  return Response.redirect(await createPdfDownloadUrl(objectKey, fileName), 302);
}

export async function createPdfUploadCommand(input: {
  body: Blob | ReadableStream | Uint8Array;
  contentLength: number;
  courseSlug: CourseSlug;
  fileName: string;
}) {
  if (input.contentLength > MAX_UPLOAD_BYTES) {
    throw new Error("PDF file is too large.");
  }

  const objectKey = createCoursePdfObjectKey(input.courseSlug, input.fileName);
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const config = getR2Config();

  return {
    command: new PutObjectCommand({
      Body: input.body,
      Bucket: config.bucketName,
      ContentLength: input.contentLength,
      ContentType: PDF_MIME_TYPE,
      Key: objectKey,
    }),
    objectKey,
  };
}

export function createCoursePdfObjectKey(courseSlug: CourseSlug, fileName: string) {
  const safeBaseName = sanitizeUploadFileName(fileName).replace(/\.pdf$/i, "");
  const randomPart = crypto.randomUUID();
  return `study-materials/${courseSlug}/${randomPart}-${safeBaseName}.pdf`;
}

export function assertSafeR2ObjectKey(objectKey: string) {
  if (
    objectKey.includes("..") ||
    objectKey.includes("\\") ||
    objectKey.startsWith("/") ||
    !objectKey.startsWith("study-materials/") ||
    !objectKey.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Invalid PDF object key.");
  }
}

function sanitizeUploadFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const collapsed = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (!collapsed || !collapsed.endsWith(".pdf")) {
    throw new Error("Only PDF files are supported.");
  }

  return collapsed;
}

function sanitizeDownloadFileName(fileName: string) {
  const safe = fileName.trim().replace(/[^a-zA-Z0-9._ -]+/g, "");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe || "study-material"}.pdf`;
}
