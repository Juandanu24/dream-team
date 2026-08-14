-- ============================================================
-- Vistas de asistencias y fair play.
-- Correr DESPUÉS de 00002 (en una query aparte).
-- ============================================================

-- Tarjetas por equipo en fase de grupos, para el desempate fair play.
-- (create or replace permite anexar columnas al final de la vista)
create or replace view group_standings with (security_invoker = on) as
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
  ) filter (where r.status = 'finished'), 0) as points,
  coalesce(tc.yellow_cards, 0) as yellow_cards,
  coalesce(tc.red_cards, 0) as red_cards
from teams t
left join team_match_results r
  on r.team_id = t.id and r.stage = 'group'
left join (
  select
    e.team_id,
    count(*) filter (where e.type = 'yellow_card') as yellow_cards,
    count(*) filter (where e.type = 'red_card') as red_cards
  from match_events e
  join matches m on m.id = e.match_id
  where m.stage = 'group' and m.status = 'finished'
  group by e.team_id
) tc on tc.team_id = t.id
group by t.tournament_id, t.id, t.name, t.color, tc.yellow_cards, tc.red_cards;

-- Tabla de asistidores (todas las fases).
drop view if exists top_assists;
create view top_assists with (security_invoker = on) as
select
  m.tournament_id,
  e.player_id,
  p.full_name,
  p.photo_url,
  e.team_id,
  t.name as team_name,
  t.color as team_color,
  count(*) as assists
from match_events e
join matches m on m.id = e.match_id
join players p on p.id = e.player_id
join teams t on t.id = e.team_id
where e.type = 'assist'
group by m.tournament_id, e.player_id, p.full_name, p.photo_url, e.team_id, t.name, t.color;
