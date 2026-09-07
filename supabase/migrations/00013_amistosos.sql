-- ============================================================
-- Dream Team — Partidos amistosos.
--
-- Los que juega la gente del parche por FUERA del torneo. No van tablas
-- del torneo por tres razones concretas:
--
--  * lineups, matches y teams tienen tournament_id not null.
--  * team_players tiene unique (tournament_id, player_id): un jugador
--    solo puede estar en un equipo por torneo. Con lados que rotan cada
--    semana, eso se rompe al segundo amistoso.
--  * players exige email único, edad, pie y posición, así que meter ahí
--    a un invitado obliga a inventarle un correo.
--
-- Se reusa el enum lineup_line y, del lado del código, el mismo dibujo
-- de cancha y el mismo mensaje de WhatsApp que el torneo.
-- ============================================================

create table friendlies (
  id uuid primary key default gen_random_uuid(),
  -- "Amistoso del martes", "Pica'o de fin de mes"…
  title text not null default 'Amistoso',
  kickoff_at timestamptz,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table friendly_sides (
  id uuid primary key default gen_random_uuid(),
  friendly_id uuid not null references friendlies (id) on delete cascade,
  -- "Claros", "Oscuros", "Los de Juan"… nombre libre.
  name text not null,
  color text,
  crest_url text,
  formation text not null default '3-3-2',
  notes text,
  -- 0 = local, 1 = visitante. Siempre son dos.
  slot smallint not null check (slot in (0, 1)),
  created_at timestamptz not null default now(),
  unique (friendly_id, slot),
  -- Clave compuesta, para que friendly_players pueda garantizar que
  -- nadie juegue para los dos lados. Mismo truco que team_players con
  -- (team_id, tournament_id).
  unique (id, friendly_id)
);

create table friendly_players (
  id uuid primary key default gen_random_uuid(),
  side_id uuid not null,
  friendly_id uuid not null,
  -- Si es del Dream Team apunta a players, y de ahí sale su foto para
  -- la cancha. Nulo cuando es alguien de afuera.
  player_id uuid references players (id) on delete set null,
  -- Solo para el invitado que no está en players. La cancha cae a las
  -- iniciales cuando no hay foto, así que no rompe el dibujo.
  guest_name text,
  line lineup_line not null,
  slot int not null default 0 check (slot between 0 and 7),
  is_starter boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (side_id, friendly_id)
    references friendly_sides (id, friendly_id) on delete cascade,
  -- O es alguien de la base, o es un invitado con nombre. Una fila sin
  -- ninguno de los dos no identifica a nadie.
  constraint friendly_players_identidad check (
    player_id is not null
    or nullif(btrim(guest_name), '') is not null
  )
);

-- Dos titulares no pueden ocupar la misma casilla de la cancha.
-- Parcial, porque los suplentes comparten slot 0 a propósito.
create unique index idx_friendly_casilla_unica
  on friendly_players (side_id, line, slot)
  where is_starter;

-- Un jugador de la base no puede repetirse en el mismo amistoso, ni en
-- un lado ni jugando para los dos.
create unique index idx_friendly_jugador_unico
  on friendly_players (friendly_id, player_id)
  where player_id is not null;

create index idx_friendly_sides_friendly on friendly_sides (friendly_id);
create index idx_friendly_players_side on friendly_players (side_id);
create index idx_friendlies_kickoff on friendlies (kickoff_at desc);

-- ---------- RLS ----------
-- Igual que el resto: habilitado sin políticas, todo pasa por el
-- service role desde el servidor.
alter table friendlies enable row level security;
alter table friendly_sides enable row level security;
alter table friendly_players enable row level security;
