import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  createAdvancedQuestion,
  getAdvancedQuestions,
} from "@/lib/admin/advanced-practice";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId") || undefined;
  const courseSlug = url.searchParams.get("course") || url.searchParams.get("courseSlug") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const isActiveParam = url.searchParams.get("isActive");
  const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;

  try {
    const data = await getAdvancedQuestions({
      collectionId,
      courseSlug,
      search,
      isActive,
      page,
      limit,
    });

    return NextResponse.json({
      ...data,
      pagination: {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Advanced questions." },
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
    collectionId?: string;
    questionText?: string;
    prompt?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    explanation?: string;
    isActive?: boolean;
  };

  const collectionId = (payload.collectionId || "").trim();
  const questionText = (payload.questionText || payload.prompt || "").trim();
  const optionA = (payload.optionA || "").trim();
  const optionB = (payload.optionB || "").trim();
  const optionC = (payload.optionC || "").trim();
  const optionD = (payload.optionD || "").trim();
  const correctOption = (payload.correctOption || "").trim().toUpperCase() as "A" | "B" | "C" | "D";

  if (!collectionId) {
    return NextResponse.json({ error: "Collection ID is required." }, { status: 400 });
  }
  if (!questionText) {
    return NextResponse.json({ error: "Question text is required." }, { status: 400 });
  }
  if (!optionA || !optionB || !optionC || !optionD) {
    return NextResponse.json({ error: "All four options (A, B, C, D) are required." }, { status: 400 });
  }
  if (!["A", "B", "C", "D"].includes(correctOption)) {
    return NextResponse.json({ error: "Correct option must be A, B, C, or D." }, { status: 400 });
  }

  try {
    const created = await createAdvancedQuestion(auth.user.id, {
      collectionId,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      explanation: payload.explanation,
      isActive: payload.isActive,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create Advanced question.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
