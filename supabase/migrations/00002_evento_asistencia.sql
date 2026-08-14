-- ============================================================
-- Nuevo tipo de evento: asistencia.
-- OJO: correr este archivo SOLO, en su propia query del SQL Editor.
-- Postgres no permite usar un valor nuevo de enum en la misma
-- transacción donde se crea, así que las vistas van en 00003.
-- ============================================================

alter type match_event_type add value if not exists 'assist';
