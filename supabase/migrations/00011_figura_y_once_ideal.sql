-- ============================================================
-- Dream Team — Jugador del partido y once ideal de la fecha.
--
-- Dos cosas distintas que se agregan juntas:
--
-- 1. La FIGURA de cada partido. Es una sola por partido y la escoge el
--    admin a dedo, no sale de una fórmula: el que más corrió o el que
--    salvó bajo palos no aparece en ninguna estadística. Por eso es una
--    columna en matches y no una vista.
--
-- 2. El ONCE IDEAL de la fecha. NO cuelga de ningún equipo — mezcla
--    jugadores de los cuatro — ni de un partido, porque cubre la semana
--    entera. Por eso no reutiliza `lineups`, que exige team_id y
--    match_id; sí reutiliza el enum `lineup_line` de 00010, que ya
--    modela exactamente lo mismo: línea de la cancha más lugar dentro
--    de la línea.
-- ============================================================

-- ---------- Figura del partido ----------
-- on delete set null: si se borra al jugador, el partido se queda sin
-- figura pero no se pierde el resultado.
alter table matches
  add column if not exists mvp_player_id uuid
    references players (id) on delete set null;

create index if not exists idx_matches_mvp on matches (mvp_player_id);

-- ---------- Once ideal de la fecha ----------
create table if not exists team_of_week (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  week int not null,
  -- Sin el arquero, igual que en lineups: "3-3-2" suma 8 de campo.
  formation text not null default '3-3-2',
  notes text,
  -- null = borrador: no sale en la web pública.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, week)
);

create table if not exists team_of_week_players (
  id uuid primary key default gen_random_uuid(),
  totw_id uuid not null references team_of_week (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  line lineup_line not null,
  slot int not null default 0 check (slot between 0 and 7),
  created_at timestamptz not null default now(),
  -- Nadie puede estar dos veces en el mismo once.
  unique (totw_id, player_id)
);

create index if not exists idx_totw_tournament on team_of_week (tournament_id, week);
create index if not exists idx_totw_players on team_of_week_players (totw_id);

-- Dos jugadores no pueden ocupar la misma casilla de la cancha. Acá no
-- hace falta que el índice sea parcial —como sí lo era en lineups— porque
-- el once ideal no tiene suplentes: son nueve y ya.
create unique index if not exists idx_totw_casilla_unica
  on team_of_week_players (totw_id, line, slot);

-- ---------- RLS ----------
-- Igual que el resto: habilitado sin políticas, todo pasa por el
-- service role desde el servidor.
alter table team_of_week enable row level security;
alter table team_of_week_players enable row level security;
