-- ============================================================
-- Row-Level Security (RLS) — Tenant Isolation
--
-- This migration enables RLS on all per-tenant tables and
-- creates PERMISSIVE policies that restrict every row access
-- to the current tenant context.
--
-- Tenant context is set per-transaction via:
--   SELECT set_config('app.current_tenant_id', '<id>', TRUE)
-- The TRUE flag makes it transaction-local (safe with pgBouncer).
--
-- When no tenant context is set, current_setting() returns NULL
-- (missing_ok = TRUE), causing all WHERE checks to fail →
-- empty result set. No data leak possible.
-- ============================================================

-- ============================================================
-- Helper function to get current tenant id safely
-- ============================================================
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- Enable RLS on per-tenant tables
-- ============================================================
ALTER TABLE "tenant_admins"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "barbers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminders"      ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (the app DB user)
-- This ensures superuser connections in tests also go through RLS
-- unless explicitly using BYPASSRLS role
ALTER TABLE "tenant_admins"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "barbers"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "services"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "customers"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "appointments"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "conversations"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "messages"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "reminders"      FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies — tenant_admins
-- ============================================================
CREATE POLICY "tenant_admins_tenant_isolation" ON "tenant_admins"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — barbers
-- ============================================================
CREATE POLICY "barbers_tenant_isolation" ON "barbers"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — services
-- ============================================================
CREATE POLICY "services_tenant_isolation" ON "services"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — customers
-- ============================================================
CREATE POLICY "customers_tenant_isolation" ON "customers"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — appointments
-- ============================================================
CREATE POLICY "appointments_tenant_isolation" ON "appointments"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — conversations
-- ============================================================
CREATE POLICY "conversations_tenant_isolation" ON "conversations"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — messages
-- ============================================================
CREATE POLICY "messages_tenant_isolation" ON "messages"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RLS Policies — reminders
-- ============================================================
CREATE POLICY "reminders_tenant_isolation" ON "reminders"
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- Create a role that bypasses RLS for platform-level operations
-- (migrations, seeding, super-admin direct DB access)
-- The app user does NOT get this role — it goes through RLS.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'barberflow_platform') THEN
    CREATE ROLE barberflow_platform BYPASSRLS;
  END IF;
END
$$;
