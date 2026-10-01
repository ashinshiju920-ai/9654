import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  USERS                                                              */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("student"),
    accountStatus: text("account_status").notNull().default("active"),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("users_role_check", sql`${table.role} in ('student', 'admin')`),
    check(
      "users_account_status_check",
      sql`${table.accountStatus} in ('active', 'suspended', 'pending')`,
    ),
    index("users_email_idx").on(table.email),
  ],
);

/* ------------------------------------------------------------------ */
/*  SESSIONS  (opaque, database-backed)                                */
/* ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").unique().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  PASSWORD RESET TOKENS                                              */
/* ------------------------------------------------------------------ */

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
  ],
);

/* ------------------------------------------------------------------ */
/*  COURSES                                                            */
/* ------------------------------------------------------------------ */

export const courses = pgTable(
  "courses",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "courses_slug_check",
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9-]+$'`,
    ),
    check("courses_display_order_positive_check", sql`${table.displayOrder} > 0`),
    index("courses_active_order_idx").on(table.isActive, table.displayOrder),
  ],
);

/* ------------------------------------------------------------------ */
/*  COURSE PDFS                                                        */
/* ------------------------------------------------------------------ */

export const coursePdfs = pgTable(
  "course_pdfs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    r2ObjectKey: text("r2_object_key").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    isPublished: boolean("is_published").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "course_pdfs_file_size_nonnegative_check",
      sql`${table.fileSizeBytes} is null or ${table.fileSizeBytes} >= 0`,
    ),
    check("course_pdfs_mime_type_check", sql`${table.mimeType} = 'application/pdf'`),
    index("course_pdfs_course_published_order_idx").on(
      table.courseId,
      table.isPublished,
      table.displayOrder,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/*  QUESTIONS                                                          */
/* ------------------------------------------------------------------ */

export const questions = pgTable(
  "questions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    optionC: text("option_c").notNull(),
    optionD: text("option_d").notNull(),
    correctOption: text("correct_option").notNull(),
    explanation: text("explanation"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "questions_correct_option_check",
      sql`${table.correctOption} in ('A', 'B', 'C', 'D')`,
    ),
    index("questions_course_active_idx").on(table.courseId, table.isActive),
  ],
);

/* ------------------------------------------------------------------ */
/*  QUIZ ATTEMPTS                                                      */
/* ------------------------------------------------------------------ */

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    testSize: integer("test_size").notNull(),
    status: text("status").notNull().default("in_progress"),
    score: integer("score"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("quiz_attempts_test_size_check", sql`${table.testSize} in (20, 50, 100)`),
    check(
      "quiz_attempts_status_check",
      sql`${table.status} in ('in_progress', 'submitted', 'abandoned')`,
    ),
    check(
      "quiz_attempts_score_nonnegative_check",
      sql`${table.score} is null or ${table.score} >= 0`,
    ),
    check(
      "quiz_attempts_percentage_range_check",
      sql`${table.percentage} is null or (${table.percentage} >= 0 and ${table.percentage} <= 100)`,
    ),
    check(
      "quiz_attempts_submitted_status_check",
      sql`(${table.status} = 'submitted') = (${table.submittedAt} is not null)`,
    ),
    index("quiz_attempts_user_course_created_idx").on(table.userId, table.courseId, table.createdAt),
    index("quiz_attempts_course_idx").on(table.courseId),
  ],
);

/* ------------------------------------------------------------------ */
/*  QUIZ ATTEMPT QUESTIONS                                             */
/* ------------------------------------------------------------------ */

export const quizAttemptQuestions = pgTable(
  "quiz_attempt_questions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    questionOrder: integer("question_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("quiz_attempt_questions_order_positive_check", sql`${table.questionOrder} > 0`),
    unique("quiz_attempt_questions_attempt_question_unique").on(table.attemptId, table.questionId),
    unique("quiz_attempt_questions_attempt_order_unique").on(table.attemptId, table.questionOrder),
    index("quiz_attempt_questions_attempt_order_idx").on(table.attemptId, table.questionOrder),
    index("quiz_attempt_questions_question_idx").on(table.questionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  STUDENT ANSWERS                                                    */
/* ------------------------------------------------------------------ */

export const studentAnswers = pgTable(
  "student_answers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedOption: text("selected_option").notNull(),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "student_answers_selected_option_check",
      sql`${table.selectedOption} in ('A', 'B', 'C', 'D')`,
    ),
    unique("student_answers_attempt_question_unique").on(table.attemptId, table.questionId),
    foreignKey({
      name: "student_answers_attempt_question_fk",
      columns: [table.attemptId, table.questionId],
      foreignColumns: [quizAttemptQuestions.attemptId, quizAttemptQuestions.questionId],
    }).onDelete("cascade"),
    index("student_answers_attempt_question_idx").on(table.attemptId, table.questionId),
    index("student_answers_question_idx").on(table.questionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  RELATIONS                                                          */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  passwordResetTokens: many(passwordResetTokens),
  quizAttempts: many(quizAttempts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  pdfs: many(coursePdfs),
  questions: many(questions),
  quizAttempts: many(quizAttempts),
}));

export const coursePdfsRelations = relations(coursePdfs, ({ one }) => ({
  course: one(courses, { fields: [coursePdfs.courseId], references: [courses.id] }),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  course: one(courses, { fields: [questions.courseId], references: [courses.id] }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, { fields: [quizAttempts.userId], references: [users.id] }),
  course: one(courses, { fields: [quizAttempts.courseId], references: [courses.id] }),
  attemptQuestions: many(quizAttemptQuestions),
  studentAnswers: many(studentAnswers),
}));

export const quizAttemptQuestionsRelations = relations(quizAttemptQuestions, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAttemptQuestions.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [quizAttemptQuestions.questionId],
    references: [questions.id],
  }),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [studentAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [studentAnswers.questionId],
    references: [questions.id],
  }),
}));
