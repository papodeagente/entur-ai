-- ENTUR AI · Sprint 5
-- Promove o primeiro usuário cadastrado a director (admin de fato).
-- Idempotente: só atualiza se ainda não houver nenhum director no tenant.

UPDATE "user"
SET role = 'director'
WHERE tenant_id = 'entur'
  AND id = (
    SELECT id FROM "user"
    WHERE tenant_id = 'entur'
    ORDER BY created_at ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "user"
    WHERE tenant_id = 'entur' AND role = 'director'
  );
