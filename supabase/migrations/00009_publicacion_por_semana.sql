-- ============================================================
-- Publicación del calendario semana por semana.
-- Marca cuándo se anunció cada partido, para saber qué semanas
-- ya se avisaron y no repetir la notificación.
-- ============================================================

alter table matches add column if not exists announced_at timestamptz;
