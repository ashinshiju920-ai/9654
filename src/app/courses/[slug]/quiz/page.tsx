import { notFound } from "next/navigation";

import { Badge, ButtonLink, Card, CardBody, CardHeader } from "@/components/ui";
import { getCourse } from "@/lib/courses";
import { quizSizes } from "@/lib/quiz";

type QuizPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
  const { slug } = await params;
  const course = getCourse(slug);

  if (!course) {
    notFound();
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Quiz</p>
          <h1 className="page-title">{course.name} Practice</h1>
          <p className="page-subtitle">
            This route is reserved for authenticated quiz attempts backed by the editable
            100-question bank.
          </p>
        </div>
      </section>

      <section className="quiz-layout">
        <Card>
          <CardHeader>
            <div>
              <Badge tone="teal">Question 7 of 20</Badge>
              <h2>Practice preview</h2>
              <p>Quiz attempts will lock the shuffled question set on creation.</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="progress-bar" aria-label="Quiz progress">
              <span />
            </div>
            <p>
              Which answer best completes the practice item shown for this locked attempt preview?
            </p>
            <div className="answer-list">
              {["Option A", "Option B", "Option C", "Option D"].map((option, index) => (
                <div
                  className={index === 2 ? "answer-option is-selected" : "answer-option"}
                  key={option}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2>Choose attempt size</h2>
              <p>Select the number of questions before the server creates the locked attempt.</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="quiz-sizes" aria-label="Quiz sizes">
              {quizSizes.map((size) => (
                <span className="quiz-size" key={size}>
                  {size} questions
                </span>
              ))}
            </div>
            <ButtonLink href={`/courses/${course.slug}`} variant="secondary">
              Back to {course.name}
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
