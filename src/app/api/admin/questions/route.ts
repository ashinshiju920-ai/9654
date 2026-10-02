import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { courses, questions } from "@/lib/db/schema";
import { getAdminQuestions } from "@/lib/admin/queries";
import { logAdminAudit } from "@/lib/admin/audit";

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("course") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const isActiveParam = url.searchParams.get("isActive");
  const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

  try {
    const data = await getAdminQuestions({
      courseSlug,
      search,
      isActive,
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load questions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const {
    courseSlug,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    isActive = true,
  } = body as {
    courseSlug?: string;
    questionText?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    explanation?: string;
    isActive?: boolean;
  };

  if (!courseSlug || typeof courseSlug !== "string") {
    return NextResponse.json({ error: "Course slug is required." }, { status: 400 });
  }
  if (!questionText || typeof questionText !== "string" || !questionText.trim()) {
    return NextResponse.json({ error: "Question text is required." }, { status: 400 });
  }
  if (!optionA || typeof optionA !== "string" || !optionA.trim()) {
    return NextResponse.json({ error: "Option A is required." }, { status: 400 });
  }
  if (!optionB || typeof optionB !== "string" || !optionB.trim()) {
    return NextResponse.json({ error: "Option B is required." }, { status: 400 });
  }
  if (!optionC || typeof optionC !== "string" || !optionC.trim()) {
    return NextResponse.json({ error: "Option C is required." }, { status: 400 });
  }
  if (!optionD || typeof optionD !== "string" || !optionD.trim()) {
    return NextResponse.json({ error: "Option D is required." }, { status: 400 });
  }

  const optUpper = (correctOption || "").trim().toUpperCase();
  if (!VALID_OPTIONS.has(optUpper)) {
    return NextResponse.json({ error: "Correct option must be A, B, C, or D." }, { status: 400 });
  }

  try {
    const [course] = await withDb((db) =>
      db
        .select({ id: courses.id, slug: courses.slug })
        .from(courses)
        .where(eq(courses.slug, courseSlug.trim().toLowerCase()))
        .limit(1),
    );

    if (!course) {
      return NextResponse.json({ error: `Course '${courseSlug}' was not found.` }, { status: 400 });
    }

    const [inserted] = await withDb((db) =>
      db
        .insert(questions)
        .values({
          courseId: course.id,
          questionText: questionText.trim(),
          optionA: optionA.trim(),
          optionB: optionB.trim(),
          optionC: optionC.trim(),
          optionD: optionD.trim(),
          correctOption: optUpper as "A" | "B" | "C" | "D",
          explanation: explanation?.trim() || null,
          isActive: Boolean(isActive),
        })
        .returning(),
    );

    await logAdminAudit({
      adminUserId: auth.user.id,
      action: "question.create",
      targetType: "question",
      targetId: inserted.id,
      details: `Created question in course '${course.slug}'`,
    });

    return NextResponse.json(
      {
        success: true,
        question: {
          ...inserted,
          createdAt: inserted.createdAt.toISOString(),
          updatedAt: inserted.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create question." },
      { status: 500 },
    );
  }
}
