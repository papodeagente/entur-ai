-- ENTUR AI · migration inicial
-- Postgres 16 + pgvector

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('member', 'admin', 'director');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "department" AS ENUM ('vendas','conteudo','marketing','suporte','produto','mentoria','financeiro','diretoria','outros');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "message_role" AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "attachment_kind" AS ENUM ('image','pdf','docx','xlsx','audio','text','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "memory_source" AS ENUM ('manual','auto_extract','onboarding');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "prompt_category" AS ENUM ('vendas','conteudo','mentoria','produto','operacional','outros');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "kb_source_type" AS ENUM ('upload','drive','notion','manual','url');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== Auth =====
CREATE TABLE IF NOT EXISTS "user" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "name" VARCHAR(255),
  "image" VARCHAR(500),
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "role" "user_role" NOT NULL DEFAULT 'member',
  "department" "department" NOT NULL DEFAULT 'outros',
  "job_title" VARCHAR(120),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_user_tenant" ON "user"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" VARCHAR(255) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_session_user" ON "session"("user_id");
CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "session"("expires_at");

CREATE TABLE IF NOT EXISTS "account" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider_id" VARCHAR(64) NOT NULL,
  "account_id" VARCHAR(255) NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "expires_at" TIMESTAMPTZ,
  "scope" VARCHAR(500),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uk_account_provider" ON "account"("provider_id","account_id");
CREATE INDEX IF NOT EXISTS "idx_account_user" ON "account"("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier" VARCHAR(255) NOT NULL,
  "value" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification"("identifier");

-- ===== Conversas =====
CREATE TABLE IF NOT EXISTS "conversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" VARCHAR(200) NOT NULL DEFAULT 'Nova conversa',
  "system_prompt" TEXT,
  "model" VARCHAR(100),
  "pinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "archived" BOOLEAN NOT NULL DEFAULT FALSE,
  "branch_parent_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "conversation" DROP CONSTRAINT IF EXISTS "conversation_branch_parent_fk";
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_branch_parent_fk"
  FOREIGN KEY ("branch_parent_id") REFERENCES "conversation"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_conv_tenant_user" ON "conversation"("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_conv_user_pinned_updated" ON "conversation"("user_id","pinned","updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conv_archived" ON "conversation"("archived");

CREATE TABLE IF NOT EXISTS "message" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversation"("id") ON DELETE CASCADE,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "role" "message_role" NOT NULL,
  "content" TEXT NOT NULL,
  "model" VARCHAR(100),
  "provider" VARCHAR(50),
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "cost_cents" INTEGER,
  "thinking" TEXT,
  "tool_calls" JSONB,
  "citations" JSONB,
  "parent_message_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "message" DROP CONSTRAINT IF EXISTS "message_parent_fk";
ALTER TABLE "message" ADD CONSTRAINT "message_parent_fk"
  FOREIGN KEY ("parent_message_id") REFERENCES "message"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_msg_conv_created" ON "message"("conversation_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_msg_tenant" ON "message"("tenant_id");

CREATE TABLE IF NOT EXISTS "attachment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "kind" "attachment_kind" NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "storage_url" VARCHAR(500) NOT NULL,
  "original_name" VARCHAR(255),
  "extracted_text" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_att_message" ON "attachment"("message_id");
CREATE INDEX IF NOT EXISTS "idx_att_tenant" ON "attachment"("tenant_id");

-- ===== Memória do usuário =====
CREATE TABLE IF NOT EXISTS "user_memory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "category" VARCHAR(50),
  "source" "memory_source" NOT NULL DEFAULT 'auto_extract',
  "source_conv_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_mem_user_updated" ON "user_memory"("user_id","updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_mem_tenant" ON "user_memory"("tenant_id");

-- ===== Biblioteca de prompts =====
CREATE TABLE IF NOT EXISTS "prompt_template" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "category" "prompt_category" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "variables" JSONB,
  "created_by" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_prompt_tenant_cat" ON "prompt_template"("tenant_id","category");

-- ===== Knowledge base (RAG) =====
CREATE TABLE IF NOT EXISTS "kb_document" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "title" VARCHAR(300) NOT NULL,
  "source_url" VARCHAR(500),
  "source_type" "kb_source_type" NOT NULL,
  "mime_type" VARCHAR(100),
  "storage_url" VARCHAR(500),
  "category" VARCHAR(80),
  "total_chunks" INTEGER NOT NULL DEFAULT 0,
  "indexed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_kb_tenant_cat" ON "kb_document"("tenant_id","category");

CREATE TABLE IF NOT EXISTS "kb_chunk" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL REFERENCES "kb_document"("id") ON DELETE CASCADE,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "tokens" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_chunk_doc" ON "kb_chunk"("document_id");
CREATE INDEX IF NOT EXISTS "idx_chunk_tenant" ON "kb_chunk"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_chunk_embedding_hnsw"
  ON "kb_chunk" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ===== Auditoria de uso =====
CREATE TABLE IF NOT EXISTS "usage_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'entur',
  "user_id" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  "conversation_id" UUID,
  "message_id" UUID,
  "provider" VARCHAR(50) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_cents" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "error" VARCHAR(500),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_usage_tenant_date" ON "usage_log"("tenant_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_usage_user_date" ON "usage_log"("user_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_usage_provider_model" ON "usage_log"("provider","model");

-- ===== Tenant settings =====
CREATE TABLE IF NOT EXISTS "tenant_setting" (
  "tenant_id" VARCHAR(64) NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tenant_id","key")
);

-- ===== Trigger updated_at =====
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_updated_at ON "user";
CREATE TRIGGER set_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_session_updated_at ON "session";
CREATE TRIGGER set_session_updated_at BEFORE UPDATE ON "session" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_account_updated_at ON "account";
CREATE TRIGGER set_account_updated_at BEFORE UPDATE ON "account" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_verification_updated_at ON "verification";
CREATE TRIGGER set_verification_updated_at BEFORE UPDATE ON "verification" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_conversation_updated_at ON "conversation";
CREATE TRIGGER set_conversation_updated_at BEFORE UPDATE ON "conversation" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_user_memory_updated_at ON "user_memory";
CREATE TRIGGER set_user_memory_updated_at BEFORE UPDATE ON "user_memory" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_prompt_template_updated_at ON "prompt_template";
CREATE TRIGGER set_prompt_template_updated_at BEFORE UPDATE ON "prompt_template" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_kb_document_updated_at ON "kb_document";
CREATE TRIGGER set_kb_document_updated_at BEFORE UPDATE ON "kb_document" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_tenant_setting_updated_at ON "tenant_setting";
CREATE TRIGGER set_tenant_setting_updated_at BEFORE UPDATE ON "tenant_setting" FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
