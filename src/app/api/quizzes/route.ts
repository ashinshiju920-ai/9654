import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { createQuizAttempt } from "@/lib/db/quiz";
import { canUserAccessCourse } from "@/lib/entitlements";
import { quizSizes } from "@/lib/quiz";
import type { QuizSize } from "@/lib/types";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { courseSlug, testSize } = body as {
    courseSlug?: string;
    testSize?: number;
  };

  if (!courseSlug || typeof courseSlug !== "string" || !getCourse(courseSlug)) {
    return NextResponse.json({ error: "Invalid course." }, { status: 400 });
  }

  if (typeof testSize !== "number" || !quizSizes.includes(testSize as QuizSize)) {
    return NextResponse.json(
      { error: "Invalid quiz size. Choose 20, 50, or 100 questions." },
      { status: 400 },
    );
  }

  try {
    const canAccess = await canUserAccessCourse(user, courseSlug, "STANDARD");
    if (!canAccess) {
      return NextResponse.json(
        { error: "You do not have access to this course." },
        { status: 403 },
      );
    }

    const attempt = await createQuizAttempt(user.id, courseSlug, testSize);
    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create quiz attempt." },
      { status: 400 },
    );
  }
}
