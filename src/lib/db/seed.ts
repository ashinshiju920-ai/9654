import { eq } from "drizzle-orm";

import { hashPasswordAsync } from "@/lib/auth/password";
import { getDb, getPool } from "@/lib/db";
import { coursePdfs, courses, questions, users } from "@/lib/db/schema";

async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    console.error("ERROR: Database seeding is blocked in production environment.");
    process.exit(1);
  }

  const studentEmail = process.env.DEV_STUDENT_EMAIL;
  const studentPassword = process.env.DEV_STUDENT_PASSWORD;
  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;

  if (!studentEmail || !studentPassword || !adminEmail || !adminPassword) {
    console.error(
      "ERROR: DEV_STUDENT_EMAIL, DEV_STUDENT_PASSWORD, DEV_ADMIN_EMAIL, and DEV_ADMIN_PASSWORD are required to run the development seed.",
    );
    process.exit(1);
  }

  const db = await getDb();
  console.log("Seeding development database...");

  // 1. Seed Users (Student & Admin)
  const studentHash = await hashPasswordAsync(studentPassword);

  const adminHash = await hashPasswordAsync(adminPassword);

  const existingStudent = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, studentEmail))
    .limit(1);

  if (existingStudent.length === 0) {
    await db.insert(users).values({
      email: studentEmail,
      passwordHash: studentHash,
      fullName: "Test Student",
      role: "student",
      accountStatus: "active",
      emailVerified: true,
    });
    console.log(`Created test student: ${studentEmail}`);
  } else {
    console.log(`Test student already exists: ${studentEmail}`);
  }

  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: adminHash,
      fullName: "System Admin",
      role: "admin",
      accountStatus: "active",
      emailVerified: true,
    });
    console.log(`Created test admin: ${adminEmail}`);
  } else {
    console.log(`Test admin already exists: ${adminEmail}`);
  }

  // 2. Seed Courses
  const courseData = [
    { slug: "ielts", name: "IELTS Preparation", displayOrder: 1 },
    { slug: "oet", name: "OET Preparation", displayOrder: 2 },
    { slug: "pte", name: "PTE Academic", displayOrder: 3 },
    { slug: "german", name: "German Language", displayOrder: 4 },
  ];

  const courseMap = new Map<string, string>();

  for (const c of courseData) {
    const existing = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, c.slug))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(courses)
        .values({
          slug: c.slug,
          name: c.name,
          displayOrder: c.displayOrder,
          isActive: true,
        })
        .returning({ id: courses.id });
      courseMap.set(c.slug, inserted.id);
      console.log(`Created course: ${c.name} (${c.slug})`);
    } else {
      courseMap.set(c.slug, existing[0].id);
      console.log(`Course exists: ${c.name}`);
    }
  }

  // 3. Seed Course PDFs
  const ieltsCourseId = courseMap.get("ielts");
  if (ieltsCourseId) {
    const existingPdfs = await db
      .select({ id: coursePdfs.id })
      .from(coursePdfs)
      .where(eq(coursePdfs.courseId, ieltsCourseId))
      .limit(1);

    if (existingPdfs.length === 0) {
      await db.insert(coursePdfs).values([
        {
          courseId: ieltsCourseId,
          title: "IELTS Academic Writing Task 1 Guide",
          description: "Essential strategies, band descriptors, and model answers.",
          r2ObjectKey: "study-materials/ielts/ielts-writing-task-1.pdf",
          fileSizeBytes: 2450000,
          mimeType: "application/pdf",
          isPublished: true,
          displayOrder: 1,
        },
        {
          courseId: ieltsCourseId,
          title: "IELTS Speaking Part 2 Cue Cards Collection",
          description: "High-scoring idioms, vocabulary, and cue cards.",
          r2ObjectKey: "study-materials/ielts/ielts-speaking-cards.pdf",
          fileSizeBytes: 1850000,
          mimeType: "application/pdf",
          isPublished: true,
          displayOrder: 2,
        },
      ]);
      console.log("Created sample study materials for IELTS.");
    }
  }

  // 4. Seed Questions (at least 20 questions for IELTS to test full attempts)
  if (ieltsCourseId) {
    const existingQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.courseId, ieltsCourseId))
      .limit(1);

    if (existingQuestions.length === 0) {
      const sampleQuestions = Array.from({ length: 22 }, (_, idx) => ({
        courseId: ieltsCourseId,
        questionText: `Sample IELTS Practice Question ${idx + 1}: Which option provides the correct grammatical structure?`,
        optionA: `Subject-verb agreement form (${idx + 1}-A)`,
        optionB: `Passive tense structure (${idx + 1}-B)`,
        optionC: `Inverted conditional construction (${idx + 1}-C)`,
        optionD: `Gerund phrase modifier (${idx + 1}-D)`,
        correctOption: (["A", "B", "C", "D"] as const)[idx % 4],
        explanation: `Detailed explanation for Question ${idx + 1} verifying the correct grammatical rule.`,
        isActive: true,
      }));

      await db.insert(questions).values(sampleQuestions);
      console.log(`Created ${sampleQuestions.length} sample practice questions for IELTS.`);
    }
  }

  console.log("Database seeding completed successfully!");
  const pool = await getPool();
  await pool.end();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
