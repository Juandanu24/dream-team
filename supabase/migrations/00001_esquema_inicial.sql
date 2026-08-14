-- ============================================================
-- Dream Team — Esquema inicial
-- Torneos, jugadores, inscripciones, equipos, partidos y eventos.
-- Toda lectura/escritura pasa por el servidor de Next.js (service role).
-- RLS queda habilitado SIN políticas: la API pública (anon key) no puede
-- leer ni escribir nada directamente.
-- ============================================================

-- ---------- Enums ----------
create type dominant_foot as enum ('right', 'left', 'both');
create type player_position as enum ('goalkeeper', 'defender', 'midfielder', 'forward');
create type registration_status as enum ('pending', 'approved', 'rejected');
create type tournament_status as enum ('registration', 'in_progress', 'finished');
create type match_stage as enum ('group', 'semifinal', 'third_place', 'final');
create type match_status as enum ('scheduled', 'finished');
create type match_event_type as enum ('goal', 'yellow_card', 'red_card');

-- ---------- Tablas ----------

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status tournament_status not null default 'registration',
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  age int not null check (age between 10 and 80),
  dominant_foot dominant_foot not null,
  position player_position not null,
  -- Tiempo en el Dream Team, texto libre: "2 años", "6 meses", "fundador"…
  member_since text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  tournament_id uuid not null references tournaments (id) on delete cascade,
  status registration_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (player_id, tournament_id)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name text not null,
  -- Color hex para identificar al equipo en la UI (#CCFF00, #FF4444…)
  color text,
  created_at timestamptz not null default now(),
  unique (tournament_id, name),
  -- Clave compuesta para que team_players pueda garantizar
  -- "un jugador solo está en un equipo por torneo".
  unique (id, tournament_id)
);

create table team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  tournament_id uuid not null,
  player_id uuid not null references players (id) on delete cascade,
  is_goalkeeper boolean not null default false,
  jersey_number int check (jersey_number between 1 and 99),
  created_at timestamptz not null default now(),
  foreign key (team_id, tournament_id) references teams (id, tournament_id) on delete cascade,
  unique (team_id, player_id),
  -- Un jugador no puede estar en dos equipos del mismo torneo.
  unique (tournament_id, player_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  stage match_stage not null,
  week int not null check (week between 1 and 10),
  kickoff_at timestamptz,
  home_team_id uuid references teams (id) on delete set null,
  away_team_id uuid references teams (id) on delete set null,
  home_score int check (home_score >= 0),
  away_score int check (away_score >= 0),
  status match_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  -- Ambos NULL está bien (cruce por definir); iguales no.
  constraint matches_distinct_teams check (
    home_team_id is null
    or away_team_id is null
    or home_team_id <> away_team_id
  ),
  -- Un partido finalizado siempre tiene marcador.
  check (status <> 'finished' or (home_score is not null and away_score is not null))
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  type match_event_type not null,
  minute int check (minute between 0 and 130),
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index idx_registrations_tournament on registrations (tournament_id, status);
create index idx_teams_tournament on teams (tournament_id);
create index idx_matches_tournament on matches (tournament_id, week);
create index idx_match_events_match on match_events (match_id);
create index idx_match_events_player on match_events (player_id, type);

-- ---------- Vistas calculadas ----------
-- Nada de esto se guarda: posiciones, goleadores y tarjetas
-- se derivan de matches y match_events.

-- Cada partido visto desde la perspectiva de cada equipo.
create view team_match_results with (security_invoker = on) as
select
  m.tournament_id,
  m.id as match_id,
  m.stage,
  m.status,
  m.home_team_id as team_id,
  m.home_score as goals_for,
  m.away_score as goals_against
from matches m
where m.home_team_id is not null
union all
select
  m.tournament_id,
  m.id,
  m.stage,
  m.status,
  m.away_team_id,
  m.away_score,
  m.home_score
from matches m
where m.away_team_id is not null;

-- Tabla de posiciones de la fase de grupos.
create view group_standings with (security_invoker = on) as
select
  t.tournament_id,
  t.id as team_id,
  t.name as team_name,
  t.color as team_color,
  count(r.match_id) filter (where r.status = 'finished') as played,
  count(r.match_id) filter (where r.status = 'finished' and r.goals_for > r.goals_against) as won,
  count(r.match_id) filter (where r.status = 'finished' and r.goals_for = r.goals_against) as drawn,
  count(r.match_id) filter (where r.status = 'finished' and r.goals_for < r.goals_against) as lost,
  coalesce(sum(r.goals_for) filter (where r.status = 'finished'), 0) as goals_for,
  coalesce(sum(r.goals_against) filter (where r.status = 'finished'), 0) as goals_against,
  coalesce(sum(r.goals_for - r.goals_against) filter (where r.status = 'finished'), 0) as goal_diff,
  coalesce(sum(
    case
      when r.goals_for > r.goals_against then 3
      when r.goals_for = r.goals_against then 1
      else 0
    end
  ) filter (where r.status = 'finished'), 0) as points
from teams t
left join team_match_results r
  on r.team_id = t.id and r.stage = 'group'
group by t.tournament_id, t.id, t.name, t.color;

-- Goleadores del torneo (todas las fases).
create view top_scorers with (security_invoker = on) as
select
  m.tournament_id,
  e.player_id,
  p.full_name,
  p.photo_url,
  e.team_id,
  t.name as team_name,
  t.color as team_color,
  count(*) as goals
from match_events e
join matches m on m.id = e.match_id
join players p on p.id = e.player_id
join teams t on t.id = e.team_id
where e.type = 'goal'
group by m.tournament_id, e.player_id, p.full_name, p.photo_url, e.team_id, t.name, t.color;

-- Tarjetas por jugador (todas las fases).
create view player_cards with (security_invoker = on) as
select
  m.tournament_id,
  e.player_id,
  p.full_name,
  p.photo_url,
  e.team_id,
  t.name as team_name,
  t.color as team_color,
  count(*) filter (where e.type = 'yellow_card') as yellow_cards,
  count(*) filter (where e.type = 'red_card') as red_cards
from match_events e
join matches m on m.id = e.match_id
join players p on p.id = e.player_id
join teams t on t.id = e.team_id
where e.type in ('yellow_card', 'red_card')
group by m.tournament_id, e.player_id, p.full_name, p.photo_url, e.team_id, t.name, t.color;

-- ---------- Storage ----------
-- Bucket público para las fotos de los jugadores (solo lectura pública;
-- la subida la hace el servidor con service role).
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- ---------- RLS ----------
-- Habilitado sin políticas = la anon key no puede tocar nada.
-- El service role (solo en el servidor) las omite.
alter table tournaments enable row level security;
alter table players enable row level security;
alter table registrations enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;
