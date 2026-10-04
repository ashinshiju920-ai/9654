import { ArrowRight, BookOpenCheck, CheckCircle2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { courses } from "@/lib/courses";

export function DashboardCommercialCard() {
  return (
    <section aria-label="Advanced Practice Hub" className="dashboard-commercial-banner">
      <div className="dashboard-commercial-banner__ambient" />

      <div className="dashboard-commercial-banner__content">
        <div className="dashboard-commercial-banner__badge">
          <Sparkles size={14} aria-hidden="true" />
          <span>Active Product · 10,000+ Questions</span>
        </div>

        <h2 className="dashboard-commercial-banner__title">
          Advanced Practice Question Banks
        </h2>

        <p className="dashboard-commercial-banner__desc">
          Take your preparation beyond standard mock tests. Access deep question pools developed
          from previous exam patterns, recurring question types, and high-priority exam topics.
        </p>

        <div className="dashboard-commercial-banner__tracks">
          <span className="dashboard-commercial-banner__tracks-label">Available Tracks:</span>
          <div className="dashboard-commercial-banner__pills">
            {courses.map((course) => (
              <Link
                className="dashboard-track-tag"
                href={`/advanced-mock-test?course=${course.slug}`}
                key={course.slug}
              >
                <span>{course.name}</span>
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>

        <div className="dashboard-commercial-banner__actions">
          <Link className="dashboard-commercial-btn" href="/advanced-mock-test">
            <BookOpenCheck size={18} aria-hidden="true" />
            <span>Explore Advanced Practice</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <span className="dashboard-commercial-hint">
            <CheckCircle2 size={13} aria-hidden="true" />
            Previous Exam Patterns · High-Priority Questions
          </span>
        </div>
      </div>

      <div className="dashboard-commercial-banner__image-col">
        <div className="dashboard-commercial-banner__image-wrap">
          <Image
            alt="Aylem Learning Advanced Practice Mock Tests"
            className="dashboard-commercial-banner__img"
            height={500}
            priority
            src="/advanced-mock-tests-banner.png.jpeg"
            unoptimized
            width={600}
          />
        </div>
      </div>
    </section>
  );
}
