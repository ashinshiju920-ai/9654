import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Languages,
  MonitorCheck,
  Stethoscope,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ButtonLink, Card, CardBody, CardHeader } from "@/components/ui";
import { DashboardCommercialCard } from "@/components/commercial/dashboard-commercial-card";
import { courses, type CourseSlug } from "@/lib/courses";

const courseIcons: Record<CourseSlug, LucideIcon> = {
  ielts: GraduationCap,
  oet: Stethoscope,
  pte: MonitorCheck,
  german: Languages,
};

export function DashboardContent() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Dashboard</p>
          <h1 className="page-title">Welcome back</h1>
          <p className="page-subtitle">
            Continue learning with published course PDFs and locked randomized mock test attempts.
          </p>
        </div>
      </section>

      {/* Advanced Practice Commercial Hub (Refined single promotional area) */}
      <DashboardCommercialCard />

      <section className="dashboard-grid" aria-label="Courses">
        {courses.map((course) => {
          const Icon = courseIcons[course.slug];

          return (
            <Card className={`course-card course-card--${course.slug}`} key={course.slug}>
              <CardBody>
                <div className="course-card__topline">
                  <span className="course-card__icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="course-card__label">Course</span>
                </div>
                <h2>{course.name}</h2>
                <p>{course.description}</p>
                <ButtonLink href={`/courses/${course.slug}`} size="sm" variant="secondary">
                  Open {course.name}
                  <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
              </CardBody>
            </Card>
          );
        })}
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
            Start a sample Mock Test
          </ButtonLink>
        </CardBody>
      </Card>
    </div>
  );
}
