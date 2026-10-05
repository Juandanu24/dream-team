-- ============================================================
-- Dream Team — Palmarés: los premios individuales de cada torneo.
--
-- El campeón y el podio se derivan de los partidos, y el goleador y la
-- valla se pueden calcular. Pero el MVP lo escoge el organizador a
-- dedo, y eso no estaba guardado en ninguna parte: vivía solo en la
-- pieza que se publicó en Instagram.
--
-- La cifra se guarda como TEXTO y congelada. Si mañana se corrigen los
-- eventos de un partido viejo, el premio no debe cambiar solo: se
-- entregó con un número y así quedó en la historia.
-- ============================================================

create table if not exists tournament_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  kind text not null check (kind in ('mvp', 'goleador', 'valla', 'fair_play')),
  player_id uuid not null references players (id) on delete cascade,
  -- "6 goles en 4 partidos", tal como se publicó.
  detail text,
  created_at timestamptz not null default now(),
  unique (tournament_id, kind)
);

create index if not exists idx_tournament_awards_tournament
  on tournament_awards (tournament_id);

alter table tournament_awards enable row level security;

-- ---------- Palmarés del primer torneo ----------
--
-- Se siembra acá porque es historia: ya se entregó y ya se publicó.
-- Los nombres se comprobaron contra la base y los tres son únicos. Si
-- alguno no coincidiera, el insert simplemente no mete esa fila en vez
-- de reventar la migración.
--
-- OJO con el goleador: del 10-6 por el tercer puesto no se cargaron los
-- goleadores, así que esa cifra sale de 50 de los 66 goles del torneo.
-- Si algún día se cargan y el líder cambia, este premio NO se corrige
-- solo — hay que decidirlo a mano, que es justamente la idea.
insert into tournament_awards (tournament_id, kind, player_id, detail)
select t.id, v.kind, p.id, v.detail
from (values
  ('mvp',      'Juan Rodriguez', '5 goles y 6 asistencias'),
  ('goleador', 'Andres Baloco',  '6 goles en 4 partidos'),
  ('valla',    'Diego Vozinha',  '6 goles recibidos en 5 partidos')
) as v(kind, nombre, detail)
join players p on p.full_name = v.nombre
join tournaments t on t.slug = 'relampago-2026'
on conflict (tournament_id, kind) do nothing;
