import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getQuizAttemptReview } from "@/lib/db/quiz";
import { isUuid } from "@/lib/materials";

type QuizReviewRouteProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function GET(_request: Request, props: QuizReviewRouteProps) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await props.params;

  if (!isUuid(attemptId)) {
    return NextResponse.json({ error: "Invalid quiz attempt." }, { status: 400 });
  }

  try {
    const result = await getQuizAttemptReview(attemptId, user.id);

    if (!result) {
      return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load quiz review.";
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("Cannot review an unsubmitted quiz attempt")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
