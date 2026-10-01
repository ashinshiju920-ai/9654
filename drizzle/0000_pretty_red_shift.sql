CREATE TABLE "course_pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"r2_object_key" text NOT NULL,
	"file_size_bytes" integer,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_pdfs_file_size_nonnegative_check" CHECK ("course_pdfs"."file_size_bytes" is null or "course_pdfs"."file_size_bytes" >= 0),
	CONSTRAINT "course_pdfs_mime_type_check" CHECK ("course_pdfs"."mime_type" = 'application/pdf')
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"display_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_slug_check" CHECK ("courses"."slug" = lower("courses"."slug") and "courses"."slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "courses_display_order_positive_check" CHECK ("courses"."display_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"correct_option" text NOT NULL,
	"explanation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_correct_option_check" CHECK ("questions"."correct_option" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempt_questions_attempt_question_unique" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "quiz_attempt_questions_attempt_order_unique" UNIQUE("attempt_id","question_order"),
	CONSTRAINT "quiz_attempt_questions_order_positive_check" CHECK ("quiz_attempt_questions"."question_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"test_size" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"percentage" numeric(5, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempts_test_size_check" CHECK ("quiz_attempts"."test_size" in (20, 50, 100)),
	CONSTRAINT "quiz_attempts_status_check" CHECK ("quiz_attempts"."status" in ('in_progress', 'submitted', 'abandoned')),
	CONSTRAINT "quiz_attempts_score_nonnegative_check" CHECK ("quiz_attempts"."score" is null or "quiz_attempts"."score" >= 0),
	CONSTRAINT "quiz_attempts_percentage_range_check" CHECK ("quiz_attempts"."percentage" is null or ("quiz_attempts"."percentage" >= 0 and "quiz_attempts"."percentage" <= 100)),
	CONSTRAINT "quiz_attempts_submitted_status_check" CHECK (("quiz_attempts"."status" = 'submitted') = ("quiz_attempts"."submitted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "student_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_answers_attempt_question_unique" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "student_answers_selected_option_check" CHECK ("student_answers"."selected_option" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"role" text DEFAULT 'student' NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('student', 'admin')),
	CONSTRAINT "users_account_status_check" CHECK ("users"."account_status" in ('active', 'suspended', 'pending'))
);
--> statement-breakpoint
ALTER TABLE "course_pdfs" ADD CONSTRAINT "course_pdfs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_attempt_question_fk" FOREIGN KEY ("attempt_id","question_id") REFERENCES "public"."quiz_attempt_questions"("attempt_id","question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_pdfs_course_published_order_idx" ON "course_pdfs" USING btree ("course_id","is_published","display_order");--> statement-breakpoint
CREATE INDEX "courses_active_order_idx" ON "courses" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "questions_course_active_idx" ON "questions" USING btree ("course_id","is_active");--> statement-breakpoint
CREATE INDEX "quiz_attempt_questions_attempt_order_idx" ON "quiz_attempt_questions" USING btree ("attempt_id","question_order");--> statement-breakpoint
CREATE INDEX "quiz_attempt_questions_question_idx" ON "quiz_attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_course_created_idx" ON "quiz_attempts" USING btree ("user_id","course_id","created_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_course_idx" ON "quiz_attempts" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "student_answers_attempt_question_idx" ON "student_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "student_answers_question_idx" ON "student_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");