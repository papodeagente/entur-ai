-- ENTUR AI · Sprint 3.5 (multimodal)
-- Adiciona attachments e outputs em message para suportar:
--  - attachments: arquivos enviados pelo usuario (image base64, pdf base64, etc)
--  - outputs: imagens geradas pela IA, code execution results, etc

ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "outputs" JSONB;
