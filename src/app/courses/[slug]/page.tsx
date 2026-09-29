import { BookOpenCheck, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { Badge, ButtonLink, Card, CardBody, CardHeader } from "@/components/ui";
import { MaterialsList } from "./materials-list";
import { getCourse } from "@/lib/courses";
import { courseAccents } from "@/lib/design";
import { getPublishedPdfsForCourse } from "@/lib/materials";
import { quizSizes } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";

type CoursePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = getCourse(slug);

  if (!course) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const pdfs = await getPublishedPdfsForCourse(course.slug);

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Course</p>
          <h1 className="page-title">{course.name}</h1>
          <p className="page-subtitle">{course.description}</p>
        </div>
        <ButtonLink href={`/courses/${course.slug}/quiz`}>
          <BookOpenCheck size={18} aria-hidden="true" />
          Open quiz
        </ButtonLink>
      </section>

      <section className="course-grid">
        <Card>
          <CardHeader>
            <div>
              <Badge tone="navy">All PDFs</Badge>
              <h2>Published study materials</h2>
              <p>Every published PDF for {course.name} appears here without extra categories.</p>
            </div>
          </CardHeader>
          <CardBody>
            <MaterialsList pdfs={pdfs} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <Badge tone={course.slug === "german" ? "gold" : "teal"}>Quiz</Badge>
              <h2>Question bank</h2>
              <p>Each course is designed for an editable 100-question bank.</p>
            </div>
            <ShieldCheck size={22} color={courseAccents[course.slug]} aria-hidden="true" />
          </CardHeader>
          <CardBody>
            <div className="quiz-sizes" aria-label="Available quiz sizes">
              {quizSizes.map((size) => (
                <span className="quiz-size" key={size}>
                  {size}
                </span>
              ))}
            </div>
            <p>
              Students choose the attempt size, then questions are randomly selected, shuffled and
              locked for that attempt.
            </p>
            <ButtonLink href={`/courses/${course.slug}/quiz`} variant="primary">
              Start quiz
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
