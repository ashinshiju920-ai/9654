import { ArrowRight, BookOpenCheck, History, Sparkles, Target } from "lucide-react";
import Link from "next/link";

import type { CourseSlug } from "@/lib/courses";

export type CourseAdvancedStripProps = {
  courseSlug: CourseSlug;
  courseName: string;
  accentColor: string;
};

export function CourseAdvancedStrip({
  courseSlug,
  courseName,
  accentColor,
}: CourseAdvancedStripProps) {
  return (
    <section
      aria-label={`${courseName} Advanced Practice`}
      className="course-advanced-pathway"
      style={{
        ["--pathway-accent" as string]: accentColor,
      }}
    >
      <div className="course-advanced-pathway__content">
        <div className="course-advanced-pathway__badge">
          <Sparkles size={14} style={{ color: accentColor }} aria-hidden="true" />
          <span>Advanced Practice Track</span>
        </div>

        <h3 className="course-advanced-pathway__title">
          Ready for more intensive {courseName} practice?
        </h3>

        <p className="course-advanced-pathway__desc">
          Step beyond the standard mock test bank. Access 10,000+ questions structured around previous
          exam patterns, recurring question styles, and high-priority {courseName} topics.
        </p>

        <div className="course-advanced-pathway__features">
          <div className="pathway-feature-chip">
            <History size={13} style={{ color: accentColor }} aria-hidden="true" />
            <span>Previous Exam Patterns</span>
          </div>
          <div className="pathway-feature-chip">
            <Target size={13} style={{ color: accentColor }} aria-hidden="true" />
            <span>High-Priority Questions</span>
          </div>
          <div className="pathway-feature-chip">
            <BookOpenCheck size={13} style={{ color: accentColor }} aria-hidden="true" />
            <span>Deeper Question Pools</span>
          </div>
        </div>
      </div>

      <div className="course-advanced-pathway__action">
        <Link
          className="course-advanced-pathway__btn"
          href={`/advanced-mock-test?course=${courseSlug}`}
          style={{
            borderColor: `${accentColor}55`,
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          <span>Explore {courseName} Advanced Practice</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <span className="course-advanced-pathway__subtext">
          Dedicated exam-focused question bank
        </span>
      </div>
    </section>
  );
}
