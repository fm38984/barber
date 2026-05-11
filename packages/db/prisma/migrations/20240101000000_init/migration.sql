-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "tenant_admin_role" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "barber_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('REQUESTED', 'CONFIRMED', 'REMINDED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "appointment_created_via" AS ENUM ('WHATSAPP', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('ACTIVE', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "reminder_status" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- ============================================================
-- PLATFORM TABLES (no RLS)
-- ============================================================

-- CreateTable: plans
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "max_barbers" INTEGER NOT NULL,
    "max_appointments_month" INTEGER NOT NULL,
    "features_json" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenants
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsapp_phone_number_id" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'TRIAL',
    "plan_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subscriptions
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: super_admin_users
CREATE TABLE "super_admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_audit_logs
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_tenant_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PER-TENANT TABLES (will have RLS enabled in next migration)
-- ============================================================

-- CreateTable: tenant_admins
CREATE TABLE "tenant_admins" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "role" "tenant_admin_role" NOT NULL DEFAULT 'MANAGER',
    "clerk_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable: barbers
CREATE TABLE "barbers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp_phone" TEXT,
    "status" "barber_status" NOT NULL DEFAULT 'ACTIVE',
    "working_hours_json" JSONB NOT NULL DEFAULT '{}',
    "commission_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: services
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price_local" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customers
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "whatsapp_phone" TEXT NOT NULL,
    "name" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_visit_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: appointments
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "barber_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'REQUESTED',
    "price_charged" DECIMAL(10,2),
    "created_via" "appointment_created_via" NOT NULL DEFAULT 'WHATSAPP',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conversations
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "state_json" JSONB NOT NULL DEFAULT '{"state":"IDLE"}',
    "status" "conversation_status" NOT NULL DEFAULT 'ACTIVE',
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "message_direction" NOT NULL,
    "whatsapp_message_id" TEXT,
    "body" TEXT NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reminders
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenants_whatsapp_phone_number_id_key" ON "tenants"("whatsapp_phone_number_id");
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE UNIQUE INDEX "super_admin_users_email_key" ON "super_admin_users"("email");
CREATE UNIQUE INDEX "tenant_admins_clerk_user_id_key" ON "tenant_admins"("clerk_user_id");
CREATE UNIQUE INDEX "tenant_admins_tenant_id_email_key" ON "tenant_admins"("tenant_id", "email");
CREATE UNIQUE INDEX "customers_tenant_id_whatsapp_phone_key" ON "customers"("tenant_id", "whatsapp_phone");
CREATE UNIQUE INDEX "conversations_tenant_id_customer_id_key" ON "conversations"("tenant_id", "customer_id");
CREATE UNIQUE INDEX "messages_whatsapp_message_id_key" ON "messages"("whatsapp_message_id");

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX "platform_audit_logs_target_tenant_id_idx" ON "platform_audit_logs"("target_tenant_id");
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");
CREATE INDEX "tenant_admins_tenant_id_idx" ON "tenant_admins"("tenant_id");
CREATE INDEX "tenant_admins_clerk_user_id_idx" ON "tenant_admins"("clerk_user_id");
CREATE INDEX "barbers_tenant_id_idx" ON "barbers"("tenant_id");
CREATE INDEX "barbers_tenant_id_status_idx" ON "barbers"("tenant_id", "status");
CREATE INDEX "services_tenant_id_idx" ON "services"("tenant_id");
CREATE INDEX "services_tenant_id_is_active_idx" ON "services"("tenant_id", "is_active");
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE INDEX "customers_tenant_id_whatsapp_phone_idx" ON "customers"("tenant_id", "whatsapp_phone");
CREATE INDEX "appointments_tenant_id_idx" ON "appointments"("tenant_id");
CREATE INDEX "appointments_tenant_id_scheduled_at_idx" ON "appointments"("tenant_id", "scheduled_at");
CREATE INDEX "appointments_tenant_id_barber_id_scheduled_at_idx" ON "appointments"("tenant_id", "barber_id", "scheduled_at");
CREATE INDEX "appointments_tenant_id_customer_id_idx" ON "appointments"("tenant_id", "customer_id");
CREATE INDEX "appointments_tenant_id_status_idx" ON "appointments"("tenant_id", "status");
CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");
CREATE INDEX "conversations_tenant_id_status_idx" ON "conversations"("tenant_id", "status");
CREATE INDEX "conversations_tenant_id_last_message_at_idx" ON "conversations"("tenant_id", "last_message_at");
CREATE INDEX "messages_tenant_id_idx" ON "messages"("tenant_id");
CREATE INDEX "messages_tenant_id_conversation_id_idx" ON "messages"("tenant_id", "conversation_id");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "reminders_tenant_id_idx" ON "reminders"("tenant_id");
CREATE INDEX "reminders_tenant_id_appointment_id_idx" ON "reminders"("tenant_id", "appointment_id");
CREATE INDEX "reminders_status_scheduled_at_idx" ON "reminders"("status", "scheduled_at");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_admins" ADD CONSTRAINT "tenant_admins_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "barbers" ADD CONSTRAINT "barbers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_barber_id_fkey"
    FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
