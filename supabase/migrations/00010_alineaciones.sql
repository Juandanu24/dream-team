-- ============================================================
-- Dream Team — Alineaciones por partido.
--
-- Una alineación por equipo y por partido. La posición NO se guarda
-- como coordenada: se guarda la línea (arquero, defensa, medio,
-- delantero) más el orden dentro de la línea, de izquierda a derecha.
-- Con eso la cancha se dibuja sin ambigüedad y la formación se puede
-- cambiar sin recolocar a nadie a mano.
--
-- Fútbol 9 = 1 arquero + 8 de campo. La formación se escribe sin el
-- arquero ("3-3-2", "3-2-3"…) y sus dígitos siempre suman 8.
-- ============================================================

create type lineup_line as enum ('gk', 'def', 'mid', 'fwd');

create table lineups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  formation text not null default '3-3-2',
  -- Nota del técnico, opcional: "llegar 15 min antes", "traje oscuro"…
  notes text,
  -- Cuándo se publicó y se notificó. null = borrador: solo la ve el
  -- admin, no sale en la web pública ni dispara push.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create table lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references lineups (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  line lineup_line not null,
  -- Orden dentro de la línea, de izquierda a derecha. Los suplentes
  -- no ocupan lugar en la cancha, así que van todos en slot 0.
  slot int not null default 0 check (slot between 0 and 7),
  is_starter boolean not null default true,
  created_at timestamptz not null default now(),
  -- Un jugador no puede aparecer dos veces en la misma alineación.
  unique (lineup_id, player_id)
);

create index idx_lineups_match on lineups (match_id);
create index idx_lineups_tournament on lineups (tournament_id);
create index idx_lineup_players_lineup on lineup_players (lineup_id);

-- Dos titulares no pueden ocupar la misma casilla de la cancha.
-- Parcial, porque los suplentes comparten slot 0 a propósito.
create unique index idx_lineup_casilla_unica
  on lineup_players (lineup_id, line, slot)
  where is_starter;

-- ---------- RLS ----------
-- Igual que el resto: habilitado sin políticas, todo pasa por el
-- service role desde el servidor.
alter table lineups enable row level security;
alter table lineup_players enable row level security;
