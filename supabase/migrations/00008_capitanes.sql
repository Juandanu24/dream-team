-- ============================================================
-- Capitán por equipo.
-- El índice único parcial garantiza a nivel de base de datos que
-- cada equipo tenga como máximo un capitán.
-- ============================================================

alter table team_players
  add column if not exists is_captain boolean not null default false;

create unique index if not exists idx_un_capitan_por_equipo
  on team_players (team_id)
  where is_captain;
