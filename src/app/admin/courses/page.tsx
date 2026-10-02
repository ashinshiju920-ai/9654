import { getAdminCourses } from "@/lib/admin/queries";
import { CourseManager } from "./course-manager";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const courses = await getAdminCourses();

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <span className="admin-badge admin-badge--navy">Curriculum</span>
          <h1 className="admin-page__title">Course Management</h1>
          <p className="admin-page__subtitle">
            Manage preparation tracks: IELTS, OET, PTE, and German Language.
          </p>
        </div>
      </header>

      <CourseManager initialCourses={courses} />
    </div>
  );
}
