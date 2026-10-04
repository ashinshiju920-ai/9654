import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Languages,
  Lock,
  MonitorCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";

import { CheckoutButton } from "@/components/commercial/checkout-button";
import type { CourseSlug } from "@/lib/courses";

export type CommercialCardState = "locked" | "owned";

export type AdvancedCourseCardProps = {
  courseSlug: CourseSlug;
  courseName: string;
  summary: string;
  focusArea: string;
  depthDescription: string;
  accentColor: string;
  state?: CommercialCardState;
  isSelected?: boolean;
  productSlug?: string | null;
  priceFormatted?: string | null;
};

const courseIcons: Record<CourseSlug, LucideIcon> = {
  ielts: GraduationCap,
  oet: Stethoscope,
  pte: MonitorCheck,
  german: Languages,
};

export function AdvancedCourseCard({
  courseSlug,
  courseName,
  summary,
  focusArea,
  depthDescription,
  accentColor,
  state = "locked",
  isSelected = false,
  productSlug,
  priceFormatted,
}: AdvancedCourseCardProps) {
  const Icon = courseIcons[courseSlug] || BookOpenCheck;

  return (
    <div
      className={`advanced-course-card advanced-course-card--${courseSlug} ${
        isSelected ? "is-selected" : ""
      }`}
      id={`track-${courseSlug}`}
      style={{
        ["--track-accent" as string]: accentColor,
      }}
    >
      <div className="advanced-course-card__header">
        <div
          className="advanced-course-card__icon-wrap"
          style={{
            backgroundColor: `${accentColor}18`,
            color: accentColor,
            borderColor: `${accentColor}33`,
          }}
        >
          <Icon size={24} aria-hidden="true" />
        </div>

        <div className="advanced-course-card__badge-row">
          <span
            className="advanced-course-card__pill"
            style={{
              backgroundColor: `${accentColor}12`,
              color: accentColor,
              borderColor: `${accentColor}30`,
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            10,000+ Question Pool
          </span>

          {state === "owned" ? (
            <span className="advanced-status-badge advanced-status-badge--owned">
              <CheckCircle2 size={12} aria-hidden="true" />
              Active Track
            </span>
          ) : (
            <span className="advanced-status-badge advanced-status-badge--locked">
              <Lock size={12} aria-hidden="true" />
              Advanced Practice
            </span>
          )}
        </div>
      </div>

      <div className="advanced-course-card__body">
        <h3 className="advanced-course-card__title">{courseName} Advanced Practice</h3>
        <p className="advanced-course-card__summary">{summary}</p>

        <div className="advanced-course-card__highlights">
          <div className="advanced-card-highlight">
            <span className="advanced-card-highlight__dot" style={{ backgroundColor: accentColor }} />
            <div>
              <strong>Primary Focus:</strong>
              <span>{focusArea}</span>
            </div>
          </div>
          <div className="advanced-card-highlight">
            <span className="advanced-card-highlight__dot" style={{ backgroundColor: accentColor }} />
            <div>
              <strong>Question Pattern:</strong>
              <span>{depthDescription}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="advanced-course-card__footer">
        {state !== "owned" && priceFormatted && (
          <div
            className="advanced-course-card__price-row"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                color: "var(--color-foreground, #ffffff)",
                letterSpacing: "-0.02em",
              }}
            >
              {priceFormatted}
            </span>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-muted-foreground, #94a3b8)",
              }}
            >
              one-time enrollment
            </span>
          </div>
        )}
        {state === "owned" ? (
          <Link
            className="advanced-card-btn advanced-card-btn--owned"
            href={`/courses/${courseSlug}/quiz`}
          >
            <span>Start Advanced Test</span>
          </Link>
        ) : productSlug ? (
          <CheckoutButton
            className="advanced-card-btn advanced-card-btn--unlock"
            label="Unlock Advanced Practice"
            productSlug={productSlug}
            style={{
              backgroundColor: accentColor,
              color: courseSlug === "german" ? "#111111" : "#ffffff",
            }}
          />
        ) : (
          <Link
            className="advanced-card-btn advanced-card-btn--unlock"
            href={`/support?topic=advanced-practice&course=${courseSlug}`}
            style={{
              backgroundColor: accentColor,
              color: courseSlug === "german" ? "#111111" : "#ffffff",
            }}
          >
            <Lock size={14} aria-hidden="true" />
            <span>Unlock Advanced Practice</span>
          </Link>
        )}
        <span className="advanced-card-note">
          Includes previous exam patterns and high-priority questions
        </span>
      </div>
    </div>
  );
}
