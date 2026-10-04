import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";

import { requireAdminApi } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { courses, questions } from "@/lib/db/schema";
import { getAdminQuestions, getAdminCourses } from "@/lib/admin/queries";
import { logAdminAudit } from "@/lib/admin/audit";

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("course") || url.searchParams.get("courseId") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const isActiveParam = url.searchParams.get("isActive");
  const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

  try {
    const [data, adminCourses] = await Promise.all([
      getAdminQuestions({
        courseSlug,
        search,
        isActive,
        page,
        limit,
      }),
      getAdminCourses(),
    ]);

    return NextResponse.json({
      ...data,
      pagination: {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      },
      courses: adminCourses.map((c) => ({
        id: c.id,
        title: c.name,
        slug: c.slug,
        questionCount: c.questionCount,
      })),
      questions: data.questions.map((q) => ({
        ...q,
        courseTitle: q.courseName,
        prompt: q.questionText,
        correctOptionId: q.correctOption,
        options: [
          { id: "A", text: q.optionA },
          { id: "B", text: q.optionB },
          { id: "C", text: q.optionC },
          { id: "D", text: q.optionD },
        ],
      })),
    });
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

  const payload = body as {
    courseSlug?: string;
    courseId?: string;
    questionText?: string;
    prompt?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    options?: Array<{ id: string; text: string }>;
    correctOption?: string;
    correctOptionId?: string;
    explanation?: string;
    isActive?: boolean;
  };

  const courseIdentifier = (payload.courseSlug || payload.courseId || "").trim();
  const qText = (payload.questionText || payload.prompt || "").trim();

  let optA = payload.optionA || "";
  let optB = payload.optionB || "";
  let optC = payload.optionC || "";
  let optD = payload.optionD || "";

  if (Array.isArray(payload.options)) {
    for (const opt of payload.options) {
      if (opt.id === "A" && !optA) optA = opt.text;
      if (opt.id === "B" && !optB) optB = opt.text;
      if (opt.id === "C" && !optC) optC = opt.text;
      if (opt.id === "D" && !optD) optD = opt.text;
    }
  }

  optA = optA.trim();
  optB = optB.trim();
  optC = optC.trim();
  optD = optD.trim();

  const correctOpt = (payload.correctOption || payload.correctOptionId || "").trim().toUpperCase();

  if (!courseIdentifier) {
    return NextResponse.json({ error: "Course is required." }, { status: 400 });
  }
  if (!qText) {
    return NextResponse.json({ error: "Question text is required." }, { status: 400 });
  }
  if (!optA || !optB || !optC || !optD) {
    return NextResponse.json({ error: "All 4 options (A, B, C, D) are required." }, { status: 400 });
  }
  if (!VALID_OPTIONS.has(correctOpt)) {
    return NextResponse.json({ error: "Correct option must be A, B, C, or D." }, { status: 400 });
  }

  try {
    const [course] = await withDb((db) =>
      db
        .select({ id: courses.id, slug: courses.slug })
        .from(courses)
        .where(
          or(
            eq(courses.slug, courseIdentifier.toLowerCase()),
            eq(courses.id, courseIdentifier),
          ),
        )
        .limit(1),
    );

    if (!course) {
      return NextResponse.json({ error: `Course was not found.` }, { status: 400 });
    }

    const [inserted] = await withDb((db) =>
      db
        .insert(questions)
        .values({
          courseId: course.id,
          questionText: qText,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctOption: correctOpt as "A" | "B" | "C" | "D",
          explanation: payload.explanation?.trim() || null,
          isActive: payload.isActive !== false,
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
          courseTitle: course.slug.toUpperCase(),
          prompt: inserted.questionText,
          correctOptionId: inserted.correctOption,
          options: [
            { id: "A", text: inserted.optionA },
            { id: "B", text: inserted.optionB },
            { id: "C", text: inserted.optionC },
            { id: "D", text: inserted.optionD },
          ],
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
