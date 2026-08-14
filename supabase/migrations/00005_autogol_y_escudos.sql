-- ============================================================
-- Autogoles + escudos de equipo.
-- El valor nuevo del enum no se usa en este archivo (las vistas de
-- goleadores solo miran 'goal'), así que puede ir en una sola query.
-- ============================================================

alter type match_event_type add value if not exists 'own_goal';

-- Escudo del equipo (los pasan los equipos, los sube el admin).
alter table teams add column if not exists crest_url text;

-- Bucket público para los escudos.
insert into storage.buckets (id, name, public)
values ('team-crests', 'team-crests', true)
on conflict (id) do nothing;
