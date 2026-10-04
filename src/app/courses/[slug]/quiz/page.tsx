import { notFound, redirect } from "next/navigation";

import { requireUserOrRedirect } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { canUserAccessCourse } from "@/lib/entitlements";
import { QuizEngine } from "./quiz-engine";

type QuizPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    attemptId?: string;
  }>;
};

export default async function QuizPage({ params, searchParams }: QuizPageProps) {
  const { slug } = await params;
  const course = getCourse(slug);

  if (!course) {
    notFound();
  }

  const user = await requireUserOrRedirect("/login");

  if (!(await canUserAccessCourse(user, course.slug, "STANDARD"))) {
    redirect("/dashboard?error=course-access-required");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <QuizEngine
      course={course}
      initialAttemptId={resolvedSearchParams.attemptId}
    />
  );
}
