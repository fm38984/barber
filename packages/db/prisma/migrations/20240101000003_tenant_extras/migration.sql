-- Add welcome_message and whatsapp_access_token to tenants
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "welcome_message" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp_access_token" TEXT NOT NULL DEFAULT '';
