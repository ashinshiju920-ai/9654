CREATE TABLE "commerce_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"provider" text DEFAULT 'CASHFREE' NOT NULL,
	"provider_environment" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_session_id" text,
	"provider_order_status" text,
	"failure_reason" text,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_orders_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "commerce_orders_amount_positive_check" CHECK ("commerce_orders"."amount_minor" > 0),
	CONSTRAINT "commerce_orders_currency_check" CHECK ("commerce_orders"."currency" = 'INR'),
	CONSTRAINT "commerce_orders_status_check" CHECK ("commerce_orders"."status" in ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
	CONSTRAINT "commerce_orders_provider_check" CHECK ("commerce_orders"."provider" = 'CASHFREE'),
	CONSTRAINT "commerce_orders_provider_environment_check" CHECK ("commerce_orders"."provider_environment" in ('SANDBOX', 'PRODUCTION'))
);
--> statement-breakpoint
CREATE TABLE "commerce_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'CASHFREE' NOT NULL,
	"provider_payment_id" text NOT NULL,
	"status" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"event_type" text,
	"payment_group" text,
	"payment_message" text,
	"bank_reference" text,
	"error_code" text,
	"raw_provider_status" text,
	"provider_payment_time" timestamp with time zone,
	"raw_payload" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_payments_provider_payment_unique" UNIQUE("provider","provider_payment_id"),
	CONSTRAINT "commerce_payments_amount_nonnegative_check" CHECK ("commerce_payments"."amount_minor" >= 0),
	CONSTRAINT "commerce_payments_currency_check" CHECK ("commerce_payments"."currency" = 'INR'),
	CONSTRAINT "commerce_payments_provider_check" CHECK ("commerce_payments"."provider" = 'CASHFREE'),
	CONSTRAINT "commerce_payments_status_check" CHECK ("commerce_payments"."status" in ('SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED', 'CANCELLED', 'UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE "commerce_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"course_id" uuid NOT NULL,
	"access_tier" text NOT NULL,
	"price_amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "commerce_products_slug_check" CHECK ("commerce_products"."slug" = lower("commerce_products"."slug") and "commerce_products"."slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "commerce_products_access_tier_check" CHECK ("commerce_products"."access_tier" in ('STANDARD', 'ADVANCED')),
	CONSTRAINT "commerce_products_price_positive_check" CHECK ("commerce_products"."price_amount_minor" > 0),
	CONSTRAINT "commerce_products_currency_check" CHECK ("commerce_products"."currency" = 'INR')
);
--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_product_id_commerce_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."commerce_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_order_id_commerce_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."commerce_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commerce_orders_user_created_idx" ON "commerce_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "commerce_orders_product_status_idx" ON "commerce_orders" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "commerce_orders_provider_status_idx" ON "commerce_orders" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "commerce_payments_order_idx" ON "commerce_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "commerce_payments_user_created_idx" ON "commerce_payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "commerce_payments_status_idx" ON "commerce_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commerce_products_course_tier_idx" ON "commerce_products" USING btree ("course_id","access_tier");--> statement-breakpoint
CREATE INDEX "commerce_products_active_idx" ON "commerce_products" USING btree ("active");
--> statement-breakpoint
INSERT INTO "commerce_products" (
	"slug",
	"name",
	"description",
	"course_id",
	"access_tier",
	"price_amount_minor",
	"currency",
	"active"
)
SELECT
	"courses"."slug" || '-standard',
	"courses"."name" || ' Standard',
	'Standard practice access for ' || "courses"."name",
	"courses"."id",
	'STANDARD',
	24900,
	'INR',
	false
FROM "courses"
WHERE "courses"."slug" IN ('ielts', 'oet', 'pte', 'german')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "commerce_products" (
	"slug",
	"name",
	"description",
	"course_id",
	"access_tier",
	"price_amount_minor",
	"currency",
	"active"
)
SELECT
	"courses"."slug" || '-advanced',
	"courses"."name" || ' Advanced',
	'Advanced practice access for ' || "courses"."name",
	"courses"."id",
	'ADVANCED',
	49900,
	'INR',
	false
FROM "courses"
WHERE "courses"."slug" IN ('ielts', 'oet', 'pte', 'german')
ON CONFLICT ("slug") DO NOTHING;
