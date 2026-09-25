-- ============================================================
-- Dream Team — Definición por penales.
--
-- La final del primer torneo quedó 0-0 y se decidió desde el punto
-- blanco. Con solo home_score/away_score, esa final se guarda como un
-- empate sin campeón: el marcador es verdad pero no cuenta quién ganó.
--
-- No se toca el marcador en sí. Un 0-0 definido por penales SIGUE
-- siendo 0-0 para la tabla y para la diferencia de gol; los penales son
-- un desempate aparte, que es justo como lo cuenta el fútbol.
-- ============================================================

alter table matches
  add column home_penalties int check (home_penalties between 0 and 30),
  add column away_penalties int check (away_penalties between 0 and 30);

-- O están los dos o no está ninguno: media tanda no dice nada.
alter table matches add constraint matches_penales_completos check (
  (home_penalties is null) = (away_penalties is null)
);

-- Una tanda de penales siempre termina con un ganador.
alter table matches add constraint matches_penales_con_ganador check (
  home_penalties is null or home_penalties <> away_penalties
);

-- Y solo se va a penales si el partido terminó empatado.
alter table matches add constraint matches_penales_solo_si_empate check (
  home_penalties is null or home_score = away_score
);
