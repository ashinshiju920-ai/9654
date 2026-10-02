import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { courses, coursePdfs } from "@/lib/db/schema";
import {
  createCoursePdfObjectKey,
  deletePdfFromR2,
  uploadPdfToR2,
} from "@/lib/r2/client";
import { type CourseSlug } from "@/lib/courses";
import { logAdminAudit } from "@/lib/admin/audit";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data payload." }, { status: 400 });
  }

  const file = formData.get("file");
  const courseSlug = formData.get("courseSlug");
  const title = formData.get("title");
  const description = formData.get("description")?.toString() || null;
  const displayOrderStr = formData.get("displayOrder")?.toString();
  const isPublishedStr = formData.get("isPublished")?.toString();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "A valid PDF file is required." }, { status: 400 });
  }

  if (!courseSlug || typeof courseSlug !== "string") {
    return NextResponse.json({ error: "Course selection is required." }, { status: 400 });
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Material title is required." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "File cannot be empty." }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the maximum allowed size of 25MB." },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only .pdf files are accepted." }, { status: 400 });
  }

  // Read arrayBuffer and inspect PDF magic bytes "%PDF-"
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const isPdfMagic =
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d; // -

  if (!isPdfMagic) {
    return NextResponse.json(
      { error: "Invalid file content: The uploaded file is not a valid PDF document." },
      { status: 400 },
    );
  }

  // Find course in database
  const normalizedSlug = courseSlug.trim().toLowerCase();
  const [course] = await withDb((db) =>
    db
      .select({ id: courses.id, slug: courses.slug })
      .from(courses)
      .where(eq(courses.slug, normalizedSlug))
      .limit(1),
  );

  if (!course) {
    return NextResponse.json({ error: `Course '${courseSlug}' was not found.` }, { status: 400 });
  }

  const objectKey = createCoursePdfObjectKey(course.slug as CourseSlug, file.name);
  const displayOrder = displayOrderStr ? parseInt(displayOrderStr, 10) || 0 : 0;
  const isPublished = isPublishedStr === "true";

  // 1. Upload to private Cloudflare R2
  try {
    await uploadPdfToR2({
      objectKey,
      data: bytes,
      contentLength: file.size,
      contentType: "application/pdf",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file to storage." },
      { status: 502 },
    );
  }

  // 2. Insert record in PostgreSQL
  try {
    const [inserted] = await withDb((db) =>
      db
        .insert(coursePdfs)
        .values({
          courseId: course.id,
          title: title.trim(),
          description: description?.trim() || null,
          r2ObjectKey: objectKey,
          fileSizeBytes: file.size,
          mimeType: "application/pdf",
          isPublished,
          displayOrder,
        })
        .returning(),
    );

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "material.upload",
      targetType: "material",
      targetId: inserted.id,
      details: `Uploaded '${inserted.title}' for course '${course.slug}' (Key: ${objectKey}, Published: ${isPublished})`,
    });

    return NextResponse.json(
      {
        success: true,
        material: {
          ...inserted,
          createdAt: inserted.createdAt.toISOString(),
          updatedAt: inserted.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (dbError) {
    // Clean up orphaned R2 object on DB failure
    try {
      await deletePdfFromR2(objectKey);
    } catch {
      // Ignore secondary cleanup error
    }

    return NextResponse.json(
      { error: dbError instanceof Error ? dbError.message : "Failed to record material in database." },
      { status: 500 },
    );
  }
}
