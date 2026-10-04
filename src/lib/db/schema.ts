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
/*  EMAIL VERIFICATION TOKENS                                          */
/* ------------------------------------------------------------------ */

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
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
    index("email_verification_tokens_user_id_idx").on(table.userId),
    index("email_verification_tokens_token_hash_idx").on(table.tokenHash),
    index("email_verification_tokens_expires_at_idx").on(table.expiresAt),
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
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
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
/*  ADVANCED COLLECTIONS                                               */
/* ------------------------------------------------------------------ */

export const advancedCollections = pgTable(
  "advanced_collections",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "advanced_collections_slug_check",
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9-]+$'`,
    ),
    unique("advanced_collections_course_slug_unique").on(table.courseId, table.slug),
    index("advanced_collections_course_order_idx").on(
      table.courseId,
      table.isPublished,
      table.displayOrder,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/*  ADVANCED QUESTIONS                                                 */
/* ------------------------------------------------------------------ */

export const advancedQuestions = pgTable(
  "advanced_questions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => advancedCollections.id, { onDelete: "restrict" }),
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
      "advanced_questions_correct_option_check",
      sql`${table.correctOption} in ('A', 'B', 'C', 'D')`,
    ),
    index("advanced_questions_collection_active_idx").on(
      table.collectionId,
      table.isActive,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/*  ADVANCED QUIZ ATTEMPTS                                             */
/* ------------------------------------------------------------------ */

export const advancedQuizAttempts = pgTable(
  "advanced_quiz_attempts",
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
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => advancedCollections.id, { onDelete: "restrict" }),
    totalQuestions: integer("total_questions").notNull(),
    status: text("status").notNull().default("in_progress"),
    score: integer("score"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "advanced_quiz_attempts_status_check",
      sql`${table.status} in ('in_progress', 'submitted', 'abandoned')`,
    ),
    check(
      "advanced_quiz_attempts_score_nonnegative_check",
      sql`${table.score} is null or ${table.score} >= 0`,
    ),
    check(
      "advanced_quiz_attempts_percentage_range_check",
      sql`${table.percentage} is null or (${table.percentage} >= 0 and ${table.percentage} <= 100)`,
    ),
    check(
      "advanced_quiz_attempts_submitted_status_check",
      sql`(${table.status} = 'submitted') = (${table.submittedAt} is not null)`,
    ),
    index("advanced_quiz_attempts_user_col_created_idx").on(
      table.userId,
      table.collectionId,
      table.createdAt,
    ),
    index("advanced_quiz_attempts_collection_idx").on(table.collectionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  ADVANCED QUIZ ATTEMPT QUESTIONS                                    */
/* ------------------------------------------------------------------ */

export const advancedQuizAttemptQuestions = pgTable(
  "advanced_quiz_attempt_questions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => advancedQuizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => advancedQuestions.id, { onDelete: "restrict" }),
    questionOrder: integer("question_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "advanced_quiz_attempt_questions_order_check",
      sql`${table.questionOrder} > 0`,
    ),
    unique("advanced_quiz_attempt_questions_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
    unique("advanced_quiz_attempt_questions_attempt_order_unique").on(
      table.attemptId,
      table.questionOrder,
    ),
    index("advanced_quiz_attempt_questions_attempt_order_idx").on(
      table.attemptId,
      table.questionOrder,
    ),
    index("advanced_quiz_attempt_questions_question_idx").on(table.questionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  ADVANCED STUDENT ANSWERS                                           */
/* ------------------------------------------------------------------ */

export const advancedStudentAnswers = pgTable(
  "advanced_student_answers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => advancedQuizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => advancedQuestions.id, { onDelete: "restrict" }),
    selectedOption: text("selected_option").notNull(),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "advanced_student_answers_selected_option_check",
      sql`${table.selectedOption} in ('A', 'B', 'C', 'D')`,
    ),
    unique("advanced_student_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
    foreignKey({
      name: "advanced_student_answers_attempt_question_fk",
      columns: [table.attemptId, table.questionId],
      foreignColumns: [
        advancedQuizAttemptQuestions.attemptId,
        advancedQuizAttemptQuestions.questionId,
      ],
    }).onDelete("cascade"),
    index("advanced_student_answers_attempt_question_idx").on(
      table.attemptId,
      table.questionId,
    ),
    index("advanced_student_answers_question_idx").on(table.questionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  COURSE ENTITLEMENTS                                                */
/* ------------------------------------------------------------------ */

export const courseEntitlements = pgTable(
  "course_entitlements",
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
    accessTier: text("access_tier").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    source: text("source").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    externalReference: text("external_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "course_entitlements_access_tier_check",
      sql`${table.accessTier} in ('STANDARD', 'ADVANCED')`,
    ),
    check(
      "course_entitlements_status_check",
      sql`${table.status} in ('ACTIVE', 'REVOKED', 'EXPIRED')`,
    ),
    check(
      "course_entitlements_source_check",
      sql`${table.source} in ('CASHFREE', 'ADMIN', 'PROMOTION', 'IMPORT', 'MIGRATION', 'MAIN_SITE_PURCHASE')`,
    ),
    unique("course_entitlements_external_reference_unique").on(
      table.source,
      table.externalReference,
      table.userId,
      table.courseId,
      table.accessTier,
    ),
    index("course_entitlements_user_course_tier_status_idx").on(
      table.userId,
      table.courseId,
      table.accessTier,
      table.status,
    ),
    index("course_entitlements_course_status_idx").on(table.courseId, table.status),
    index("course_entitlements_external_reference_idx").on(
      table.source,
      table.externalReference,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/*  COMMERCE                                                           */
/* ------------------------------------------------------------------ */

export const commerceProducts = pgTable(
  "commerce_products",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    accessTier: text("access_tier").notNull(),
    priceAmountMinor: integer("price_amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "commerce_products_slug_check",
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9-]+$'`,
    ),
    check(
      "commerce_products_access_tier_check",
      sql`${table.accessTier} in ('STANDARD', 'ADVANCED')`,
    ),
    check("commerce_products_price_positive_check", sql`${table.priceAmountMinor} > 0`),
    check("commerce_products_currency_check", sql`${table.currency} = 'INR'`),
    index("commerce_products_course_tier_idx").on(table.courseId, table.accessTier),
    index("commerce_products_active_idx").on(table.active),
  ],
);

export const commerceOrders = pgTable(
  "commerce_orders",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => commerceProducts.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("PENDING"),
    provider: text("provider").notNull().default("CASHFREE"),
    providerEnvironment: text("provider_environment").notNull(),
    providerOrderId: text("provider_order_id").unique().notNull(),
    providerSessionId: text("provider_session_id"),
    providerOrderStatus: text("provider_order_status"),
    failureReason: text("failure_reason"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("commerce_orders_amount_positive_check", sql`${table.amountMinor} > 0`),
    check("commerce_orders_currency_check", sql`${table.currency} = 'INR'`),
    check(
      "commerce_orders_status_check",
      sql`${table.status} in ('PENDING', 'PAID', 'FAILED', 'CANCELLED')`,
    ),
    check("commerce_orders_provider_check", sql`${table.provider} = 'CASHFREE'`),
    check(
      "commerce_orders_provider_environment_check",
      sql`${table.providerEnvironment} in ('SANDBOX', 'PRODUCTION')`,
    ),
    index("commerce_orders_user_created_idx").on(table.userId, table.createdAt),
    index("commerce_orders_product_status_idx").on(table.productId, table.status),
    index("commerce_orders_provider_status_idx").on(table.provider, table.status),
  ],
);

export const commercePayments = pgTable(
  "commerce_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => commerceOrders.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().default("CASHFREE"),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: text("status").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    eventType: text("event_type"),
    paymentGroup: text("payment_group"),
    paymentMessage: text("payment_message"),
    bankReference: text("bank_reference"),
    errorCode: text("error_code"),
    rawProviderStatus: text("raw_provider_status"),
    providerPaymentTime: timestamp("provider_payment_time", { withTimezone: true }),
    rawPayload: text("raw_payload"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("commerce_payments_amount_nonnegative_check", sql`${table.amountMinor} >= 0`),
    check("commerce_payments_currency_check", sql`${table.currency} = 'INR'`),
    check("commerce_payments_provider_check", sql`${table.provider} = 'CASHFREE'`),
    check(
      "commerce_payments_status_check",
      sql`${table.status} in ('SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED', 'CANCELLED', 'UNKNOWN')`,
    ),
    unique("commerce_payments_provider_payment_unique").on(table.provider, table.providerPaymentId),
    index("commerce_payments_order_idx").on(table.orderId),
    index("commerce_payments_user_created_idx").on(table.userId, table.createdAt),
    index("commerce_payments_status_idx").on(table.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  RELATIONS                                                          */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  quizAttempts: many(quizAttempts),
  advancedQuizAttempts: many(advancedQuizAttempts),
  courseEntitlements: many(courseEntitlements),
  commerceOrders: many(commerceOrders),
  commercePayments: many(commercePayments),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, { fields: [emailVerificationTokens.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  pdfs: many(coursePdfs),
  questions: many(questions),
  quizAttempts: many(quizAttempts),
  advancedCollections: many(advancedCollections),
  advancedQuizAttempts: many(advancedQuizAttempts),
  courseEntitlements: many(courseEntitlements),
  commerceProducts: many(commerceProducts),
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

export const advancedCollectionsRelations = relations(advancedCollections, ({ one, many }) => ({
  course: one(courses, { fields: [advancedCollections.courseId], references: [courses.id] }),
  questions: many(advancedQuestions),
  quizAttempts: many(advancedQuizAttempts),
}));

export const advancedQuestionsRelations = relations(advancedQuestions, ({ one }) => ({
  collection: one(advancedCollections, {
    fields: [advancedQuestions.collectionId],
    references: [advancedCollections.id],
  }),
}));

export const advancedQuizAttemptsRelations = relations(advancedQuizAttempts, ({ one, many }) => ({
  user: one(users, { fields: [advancedQuizAttempts.userId], references: [users.id] }),
  course: one(courses, { fields: [advancedQuizAttempts.courseId], references: [courses.id] }),
  collection: one(advancedCollections, {
    fields: [advancedQuizAttempts.collectionId],
    references: [advancedCollections.id],
  }),
  attemptQuestions: many(advancedQuizAttemptQuestions),
  studentAnswers: many(advancedStudentAnswers),
}));

export const advancedQuizAttemptQuestionsRelations = relations(
  advancedQuizAttemptQuestions,
  ({ one }) => ({
    attempt: one(advancedQuizAttempts, {
      fields: [advancedQuizAttemptQuestions.attemptId],
      references: [advancedQuizAttempts.id],
    }),
    question: one(advancedQuestions, {
      fields: [advancedQuizAttemptQuestions.questionId],
      references: [advancedQuestions.id],
    }),
  }),
);

export const advancedStudentAnswersRelations = relations(advancedStudentAnswers, ({ one }) => ({
  attempt: one(advancedQuizAttempts, {
    fields: [advancedStudentAnswers.attemptId],
    references: [advancedQuizAttempts.id],
  }),
  question: one(advancedQuestions, {
    fields: [advancedStudentAnswers.questionId],
    references: [advancedQuestions.id],
  }),
}));

export const courseEntitlementsRelations = relations(courseEntitlements, ({ one }) => ({
  user: one(users, { fields: [courseEntitlements.userId], references: [users.id] }),
  course: one(courses, { fields: [courseEntitlements.courseId], references: [courses.id] }),
}));

export const commerceProductsRelations = relations(commerceProducts, ({ one, many }) => ({
  course: one(courses, { fields: [commerceProducts.courseId], references: [courses.id] }),
  orders: many(commerceOrders),
}));

export const commerceOrdersRelations = relations(commerceOrders, ({ one, many }) => ({
  user: one(users, { fields: [commerceOrders.userId], references: [users.id] }),
  product: one(commerceProducts, {
    fields: [commerceOrders.productId],
    references: [commerceProducts.id],
  }),
  payments: many(commercePayments),
}));

export const commercePaymentsRelations = relations(commercePayments, ({ one }) => ({
  order: one(commerceOrders, {
    fields: [commercePayments.orderId],
    references: [commerceOrders.id],
  }),
  user: one(users, { fields: [commercePayments.userId], references: [users.id] }),
}));

/* ------------------------------------------------------------------ */
/*  MAIN SITE PURCHASE EVENTS (Audit & Idempotency)                   */
/* ------------------------------------------------------------------ */

export const mainSitePurchaseEvents = pgTable(
  "main_site_purchase_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    externalOrderId: text("external_order_id").notNull(),
    externalReference: text("external_reference").unique().notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerEmail: text("customer_email").notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    courseSlug: text("course_slug").notNull(),
    accessTier: text("access_tier").notNull(),
    paymentStatus: text("payment_status").notNull(),
    eventStatus: text("event_status").notNull(),
    failureReason: text("failure_reason"),
    metadata: text("metadata"),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("main_site_purchase_events_external_order_id_idx").on(table.externalOrderId),
    index("main_site_purchase_events_customer_email_idx").on(table.customerEmail),
    index("main_site_purchase_events_processed_at_idx").on(table.processedAt),
  ],
);

export const mainSitePurchaseEventsRelations = relations(mainSitePurchaseEvents, ({ one }) => ({
  user: one(users, { fields: [mainSitePurchaseEvents.userId], references: [users.id] }),
  course: one(courses, { fields: [mainSitePurchaseEvents.courseId], references: [courses.id] }),
}));
