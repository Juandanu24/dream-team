-- ============================================================
-- Reto de penales: puntajes y ranking.
-- Cada intento es una fila; el ranking muestra el mejor por jugador.
-- ============================================================

create table penalty_scores (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  score int not null check (score between 0 and 5),
  shots int not null default 5 check (shots between 1 and 20),
  created_at timestamptz not null default now()
);

create index idx_penalty_scores_tournament on penalty_scores (tournament_id, score desc);
create index idx_penalty_scores_player on penalty_scores (player_id);

alter table penalty_scores enable row level security;

-- Mejor puntaje por jugador, con cuántas veces lo intentó.
create view penalty_leaderboard with (security_invoker = on) as
select
  s.tournament_id,
  s.player_id,
  p.full_name,
  p.photo_url,
  max(s.score) as best_score,
  count(*) as attempts,
  max(s.created_at) as last_played_at
from penalty_scores s
join players p on p.id = s.player_id
group by s.tournament_id, s.player_id, p.full_name, p.photo_url;
