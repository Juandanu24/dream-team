-- ============================================================
-- Fix: permitir partidos con cruces por definir.
-- El check original (home_team_id is distinct from away_team_id)
-- rechazaba filas con ambos equipos NULL — que es exactamente cómo
-- nacen las semifinales y finales. NULL IS DISTINCT FROM NULL = false.
-- ============================================================

alter table matches drop constraint matches_check;

alter table matches add constraint matches_distinct_teams check (
  home_team_id is null
  or away_team_id is null
  or home_team_id <> away_team_id
);
