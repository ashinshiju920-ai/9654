import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getLockedQuizAttempt } from "@/lib/db/quiz";
import { isUuid } from "@/lib/materials";

type QuizAttemptRouteProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function GET(_request: Request, props: QuizAttemptRouteProps) {
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
    const result = await getLockedQuizAttempt(attemptId, user.id);

    if (!result) {
      return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Quiz attempt not found." }, { status: 404 });
  }
}
