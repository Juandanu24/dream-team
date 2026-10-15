-- ============================================================
-- Dream Team — El sorteo de jugadores.
--
-- Los equipos arrancan con una base y el resto de inscritos se reparte
-- en vivo: los capitanes ELIGEN por turnos, no se sortea quién le toca a
-- quién. Lo único aleatorio es el ORDEN de elección.
--
-- Dos formas, que es el switch que pidió Juan:
--   'pool'  → un solo bombo con todos los que no tienen equipo. Se
--             sortea el orden una vez y se mantiene hasta el final.
--   'pots'  → bombos tipo Champions, armados antes por nivel de juego.
--             Cada vuelta se elige de un bombo; al vaciarse se pasa al
--             siguiente.
--
-- Y en 'pots', el orden puede sortearse una sola vez ('once') o volver a
-- sortearse al empezar cada bombo ('per_round').
-- ============================================================

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  -- Un sorteo por torneo: dos a la vez sobre el mismo plantel no
  -- significan nada y el turno dejaría de estar definido.
  tournament_id uuid not null unique references tournaments (id) on delete cascade,
  mode text not null default 'pool' check (mode in ('pool', 'pots')),
  order_mode text not null default 'once' check (order_mode in ('once', 'per_round')),
  status text not null default 'setup' check (status in ('setup', 'running', 'finished')),
  -- En 'pots' es el bombo que se está eligiendo (1 = Bombo A). En 'pool'
  -- es la vuelta: sube cuando todos los que participan ya eligieron.
  current_round smallint not null default 1 check (current_round >= 1),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Qué equipos entran y en qué puesto eligen.
--
-- `participates` existe porque no todos tienen que entrar: un equipo que
-- ya está conforme con su nómina se queda por fuera sin salir de la
-- tabla, y puede volver a entrar antes de empezar.
create table if not exists draft_teams (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  participates boolean not null default true,
  -- 1 = elige primero. Nulo hasta que se sortee el orden. Guardar el
  -- orden en la base y no en el navegador es a propósito: si lo decidiera
  -- el cliente, recargar la página sería volver a tirar los dados hasta
  -- que salga el que uno quiere.
  position smallint check (position is null or position >= 1),
  created_at timestamptz not null default now(),
  unique (draft_id, team_id)
);

-- En qué bombo quedó cada jugador. Solo se usa en modo 'pots'.
--
-- El bombo es un número (1 = A, 2 = B…) y no una tabla aparte: el nombre
-- se deriva y así no hay que mantener filas de bombos vacíos.
create table if not exists draft_pot_players (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  pot smallint not null check (pot between 1 and 10),
  created_at timestamptz not null default now(),
  -- Un jugador en un solo bombo.
  unique (draft_id, player_id)
);

-- Lo que fue pasando. El reparto de verdad vive en `team_players`, que es
-- lo que lee el resto de la app; esto guarda el ORDEN y el momento, que
-- es lo que `team_players` no puede responder y lo que hace falta para la
-- página pública y para rehacer un pick.
create table if not exists draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  -- De qué bombo salió, si venía de uno.
  pot smallint,
  round smallint not null default 1,
  -- Orden global de la elección: 1 es el primer jugador del sorteo.
  pick_number integer not null,
  created_at timestamptz not null default now(),
  -- Un jugador se elige una sola vez.
  unique (draft_id, player_id),
  unique (draft_id, pick_number)
);

create index if not exists idx_draft_teams_draft on draft_teams (draft_id);
create index if not exists idx_draft_pot_players_draft on draft_pot_players (draft_id, pot);
create index if not exists idx_draft_picks_draft on draft_picks (draft_id, pick_number);

-- RLS encendido y sin políticas, como el resto del esquema: a estas
-- tablas solo se llega por el service role desde el servidor.
alter table drafts enable row level security;
alter table draft_teams enable row level security;
alter table draft_pot_players enable row level security;
alter table draft_picks enable row level security;
