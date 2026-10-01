import { ArrowRight, BookOpenCheck, Clock3, Target } from "lucide-react";

import { Badge, ButtonLink, Card, CardBody, CardHeader, Loader, Toast } from "@/components/ui";
import { courses } from "@/lib/courses";

export function DashboardContent() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Dashboard</p>
          <h1 className="page-title">Welcome back</h1>
          <p className="page-subtitle">
            Continue learning with published course PDFs and locked randomized quiz attempts.
          </p>
        </div>
        <Toast
          title="Student Portal"
          message="PostgreSQL and R2 wiring are active."
        />
      </section>

      <section className="stat-grid" aria-label="Learning summary">
        <Card>
          <CardBody>
            <Badge tone="teal">Next up</Badge>
            <h2>Choose a course</h2>
            <p>Open a course to view every published PDF and start a quiz.</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Clock3 size={24} color="#0AA69A" aria-hidden="true" />
            <h2>20, 50 or 100</h2>
            <p>Each attempt locks a shuffled question set for consistent review.</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Loader label="Aylem course accents" />
            <h2>Four courses</h2>
            <p>IELTS, OET, PTE and German stay visually distinct.</p>
          </CardBody>
        </Card>
      </section>

      <section className="dashboard-grid" aria-label="Courses">
        {courses.map((course) => (
          <Card className={`course-card course-card--${course.slug}`} key={course.slug}>
            <CardBody>
              <h2>{course.name}</h2>
              <p>{course.description}</p>
              <ButtonLink href={`/courses/${course.slug}`} size="sm" variant="secondary">
                Open {course.name}
                <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>
            </CardBody>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div>
            <h2>Attempt rules</h2>
            <p>No material categories are shown. Course pages list all published PDFs directly.</p>
          </div>
          <Target size={22} color="#0AA69A" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <ButtonLink href="/courses/ielts/quiz">
            <BookOpenCheck size={18} aria-hidden="true" />
            Start a sample quiz flow
          </ButtonLink>
        </CardBody>
      </Card>
    </div>
  );
}
