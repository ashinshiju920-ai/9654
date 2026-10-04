CREATE TABLE "advanced_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advanced_collections_course_slug_unique" UNIQUE("course_id","slug"),
	CONSTRAINT "advanced_collections_slug_check" CHECK ("advanced_collections"."slug" = lower("advanced_collections"."slug") and "advanced_collections"."slug" ~ '^[a-z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "advanced_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
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
	CONSTRAINT "advanced_questions_correct_option_check" CHECK ("advanced_questions"."correct_option" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
CREATE TABLE "advanced_quiz_attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advanced_quiz_attempt_questions_attempt_question_unique" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "advanced_quiz_attempt_questions_attempt_order_unique" UNIQUE("attempt_id","question_order"),
	CONSTRAINT "advanced_quiz_attempt_questions_order_check" CHECK ("advanced_quiz_attempt_questions"."question_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "advanced_quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"total_questions" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"percentage" numeric(5, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advanced_quiz_attempts_status_check" CHECK ("advanced_quiz_attempts"."status" in ('in_progress', 'submitted', 'abandoned')),
	CONSTRAINT "advanced_quiz_attempts_score_nonnegative_check" CHECK ("advanced_quiz_attempts"."score" is null or "advanced_quiz_attempts"."score" >= 0),
	CONSTRAINT "advanced_quiz_attempts_percentage_range_check" CHECK ("advanced_quiz_attempts"."percentage" is null or ("advanced_quiz_attempts"."percentage" >= 0 and "advanced_quiz_attempts"."percentage" <= 100)),
	CONSTRAINT "advanced_quiz_attempts_submitted_status_check" CHECK (("advanced_quiz_attempts"."status" = 'submitted') = ("advanced_quiz_attempts"."submitted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "advanced_student_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advanced_student_answers_attempt_question_unique" UNIQUE("attempt_id","question_id"),
	CONSTRAINT "advanced_student_answers_selected_option_check" CHECK ("advanced_student_answers"."selected_option" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
ALTER TABLE "advanced_collections" ADD CONSTRAINT "advanced_collections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_questions" ADD CONSTRAINT "advanced_questions_collection_id_advanced_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."advanced_collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_quiz_attempt_questions" ADD CONSTRAINT "advanced_quiz_attempt_questions_attempt_id_advanced_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."advanced_quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_quiz_attempt_questions" ADD CONSTRAINT "advanced_quiz_attempt_questions_question_id_advanced_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."advanced_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_quiz_attempts" ADD CONSTRAINT "advanced_quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_quiz_attempts" ADD CONSTRAINT "advanced_quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_quiz_attempts" ADD CONSTRAINT "advanced_quiz_attempts_collection_id_advanced_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."advanced_collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_student_answers" ADD CONSTRAINT "advanced_student_answers_attempt_id_advanced_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."advanced_quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_student_answers" ADD CONSTRAINT "advanced_student_answers_question_id_advanced_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."advanced_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_student_answers" ADD CONSTRAINT "advanced_student_answers_attempt_question_fk" FOREIGN KEY ("attempt_id","question_id") REFERENCES "public"."advanced_quiz_attempt_questions"("attempt_id","question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advanced_collections_course_order_idx" ON "advanced_collections" USING btree ("course_id","is_published","display_order");--> statement-breakpoint
CREATE INDEX "advanced_questions_collection_active_idx" ON "advanced_questions" USING btree ("collection_id","is_active");--> statement-breakpoint
CREATE INDEX "advanced_quiz_attempt_questions_attempt_order_idx" ON "advanced_quiz_attempt_questions" USING btree ("attempt_id","question_order");--> statement-breakpoint
CREATE INDEX "advanced_quiz_attempt_questions_question_idx" ON "advanced_quiz_attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "advanced_quiz_attempts_user_col_created_idx" ON "advanced_quiz_attempts" USING btree ("user_id","collection_id","created_at");--> statement-breakpoint
CREATE INDEX "advanced_quiz_attempts_collection_idx" ON "advanced_quiz_attempts" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "advanced_student_answers_attempt_question_idx" ON "advanced_student_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "advanced_student_answers_question_idx" ON "advanced_student_answers" USING btree ("question_id");