import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchWinner } from "@/lib/match-summary";
import { TAG_TORNEO } from "@/lib/data";
import type { Match, MatchStage, Team } from "@/lib/types";

export type AwardKind = "mvp" | "goleador" | "valla" | "fair_play";

export const AWARD_LABELS: Record<AwardKind, string> = {
  mvp: "MVP del torneo",
  goleador: "Goleador",
  valla: "Valla menos vencida",
  fair_play: "Juego limpio",
};

export interface AwardWinner {
  kind: AwardKind;
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  /** Encuadre que el jugador ya tiene ajustado (migración 00012), para
   *  que la foto salga igual que en las piezas y no recortada al
   *  centro. Nulo = sin ajustar. */
  photoZoom: number | null;
  photoOffsetX: number | null;
  photoOffsetY: number | null;
  teamName: string | null;
  teamColor: string | null;
  /** La cifra con la que se entregó, congelada. */
  detail: string | null;
}

/** Las cifras del torneo, para contarlo de un vistazo. */
export interface TournamentStats {
  teams: number;
  /** Solo los que se jugaron. */
  matches: number;
  goals: number;
  /** Los que quedaron con equipo, no los inscritos. */
  players: number;
}

/** Un partido del campeón, como paso de su camino al título. */
export interface PathStep {
  /** "Fecha 1", "Semifinal", "Final"… */
  label: string;
  rivalName: string;
  rivalCrest: string | null;
  rivalColor: string | null;
  goalsFor: number;
  goalsAgainst: number;
  /** Solo si se definió desde el punto blanco. */
  penaltiesFor: number | null;
  penaltiesAgainst: number | null;
  result: "win" | "loss" | "draw";
  isFinal: boolean;
}

export interface PodiumRow {
  teamName: string;
  color: string | null;
  crestUrl: string | null;
  label: string;
}

export interface TournamentHistory {
  slug: string;
  name: string;
  /** Null si el torneo terminó sin final cargada. */
  champion: PodiumRow | null;
  podium: PodiumRow[];
  awards: AwardWinner[];
  stats: TournamentStats;
  /** Los partidos del campeón, en orden. Vacío si no hubo campeón. */
  championPath: PathStep[];
}

/** Etiqueta corta del partido para el camino del campeón. Los nombres
 *  largos de `STAGE_LABELS` no caben en un chip, y en fase de grupos lo
 *  que ubica al lector es la fecha, no la palabra "grupos". */
function pasoLabel(stage: MatchStage, week: number): string {
  if (stage === "group") return `Fecha ${week}`;
  if (stage === "semifinal") return "Semifinal";
  if (stage === "third_place") return "3er puesto";
  return "Final";
}

type AwardRow = {
  tournament_id: string;
  kind: AwardKind;
  detail: string | null;
  player_id: string;
  players: {
    full_name: string;
    photo_url: string | null;
    photo_zoom: number | null;
    photo_offset_x: number | null;
    photo_offset_y: number | null;
  } | null;
};

async function cargarPalmares(): Promise<TournamentHistory[]> {
  const supabase = createAdminClient();

  const { data: torneos } = await supabase
    .from("tournaments")
    .select("id, slug, name")
    .eq("status", "finished")
    .order("created_at", { ascending: false });

  const lista = (torneos as { id: string; slug: string; name: string }[]) ?? [];
  if (lista.length === 0) return [];

  const ids = lista.map((t) => t.id);

  // Todo de una, y se arma en memoria: una consulta por torneo sería
  // N+1 para una página que casi no cambia.
  const [matches, teams, roster, awards] = await Promise.all([
    // Todos los terminados, no solo los de cierre: de ellos salen
    // también las cifras del torneo y el camino del campeón, y son
    // diez filas por torneo. Pedir dos veces lo mismo con filtros
    // distintos costaría una consulta más para no ahorrar nada.
    supabase
      .from("matches")
      .select("*")
      .in("tournament_id", ids)
      .eq("status", "finished"),
    supabase.from("teams").select("*").in("tournament_id", ids),
    // Para saber en qué equipo jugaba el premiado ese torneo: el
    // premio guarda el jugador, no el equipo, porque el equipo ya
    // está en team_players y duplicarlo se desincroniza.
    supabase
      .from("team_players")
      .select("tournament_id, team_id, player_id")
      .in("tournament_id", ids),
    supabase
      .from("tournament_awards")
      .select(
        "*, players(full_name, photo_url, photo_zoom, photo_offset_x, photo_offset_y)",
      )
      .in("tournament_id", ids),
  ]);

  // Sin la migración 00016 la tabla no existe. La página sale igual,
  // con el campeón y el podio, que se derivan de los partidos.
  const SIN_TABLA = ["PGRST205", "42P01"];
  const premios = SIN_TABLA.includes(awards.error?.code ?? "")
    ? []
    : ((awards.data as unknown as AwardRow[]) ?? []);

  const partidos = (matches.data as Match[]) ?? [];
  const equipos = (teams.data as Team[]) ?? [];
  const equipoPorId = new Map(equipos.map((t) => [t.id, t]));

  const planteles =
    (roster.data as { tournament_id: string; team_id: string; player_id: string }[]) ??
    [];
  const equipoDe = new Map(
    planteles.map((r) => [`${r.tournament_id}:${r.player_id}`, r.team_id]),
  );

  const fila = (teamId: string | null, label: string): PodiumRow | null => {
    const t = teamId ? equipoPorId.get(teamId) : undefined;
    if (!t) return null;
    return {
      teamName: t.name,
      color: t.color,
      crestUrl: t.crest_url ?? null,
      label,
    };
  };

  return lista.map((torneo) => {
    const delTorneo = partidos.filter((m) => m.tournament_id === torneo.id);
    const final = delTorneo.find((m) => m.stage === "final");
    const tercero = delTorneo.find((m) => m.stage === "third_place");

    const podium: PodiumRow[] = [];
    for (const [match, etiquetas] of [
      [final, ["Campeón", "Subcampeón"]],
      [tercero, ["Tercer puesto", "Cuarto puesto"]],
    ] as const) {
      if (!match) continue;
      const gana = matchWinner(match);
      if (!gana) continue;
      const ganador = gana === "home" ? match.home_team_id : match.away_team_id;
      const perdedor = gana === "home" ? match.away_team_id : match.home_team_id;
      const a = fila(ganador, etiquetas[0]);
      const b = fila(perdedor, etiquetas[1]);
      if (a) podium.push(a);
      if (b) podium.push(b);
    }

    // Las cifras del torneo salen de los mismos partidos ya traídos.
    const stats: TournamentStats = {
      teams: equipos.filter((t) => t.tournament_id === torneo.id).length,
      matches: delTorneo.length,
      goals: delTorneo.reduce(
        (total, m) => total + (m.home_score ?? 0) + (m.away_score ?? 0),
        0,
      ),
      players: planteles.filter((r) => r.tournament_id === torneo.id).length,
    };

    // El camino del campeón: sus partidos en orden. Cuenta la historia
    // con datos en vez de prosa —arrancar perdiendo 0-7 y levantar la
    // copa se ve solo— y sirve para cualquier campeón, no solo este.
    const campeonId =
      final && matchWinner(final)
        ? matchWinner(final) === "home"
          ? final.home_team_id
          : final.away_team_id
        : null;

    const championPath: PathStep[] = !campeonId
      ? []
      : delTorneo
          .filter(
            (m) =>
              m.home_team_id === campeonId || m.away_team_id === campeonId,
          )
          .sort((a, b) => a.week - b.week)
          .map((m) => {
            const deLocal = m.home_team_id === campeonId;
            const rival = equipoPorId.get(
              (deLocal ? m.away_team_id : m.home_team_id) ?? "",
            );
            const gana = matchWinner(m);
            return {
              label: pasoLabel(m.stage, m.week),
              rivalName: rival?.name ?? "—",
              rivalCrest: rival?.crest_url ?? null,
              rivalColor: rival?.color ?? null,
              goalsFor: (deLocal ? m.home_score : m.away_score) ?? 0,
              goalsAgainst: (deLocal ? m.away_score : m.home_score) ?? 0,
              penaltiesFor: (deLocal ? m.home_penalties : m.away_penalties) ?? null,
              penaltiesAgainst:
                (deLocal ? m.away_penalties : m.home_penalties) ?? null,
              result:
                gana === null
                  ? ("draw" as const)
                  : (gana === "home") === deLocal
                    ? ("win" as const)
                    : ("loss" as const),
              isFinal: m.stage === "final",
            };
          });

    return {
      slug: torneo.slug,
      name: torneo.name,
      champion: podium[0] ?? null,
      stats,
      championPath,
      podium,
      awards: premios
        .filter((a) => a.tournament_id === torneo.id)
        .map((a) => {
          const equipo = equipoPorId.get(
            equipoDe.get(`${torneo.id}:${a.player_id}`) ?? "",
          );
          return {
            kind: a.kind,
            playerId: a.player_id,
            playerName: a.players?.full_name ?? "—",
            photoUrl: a.players?.photo_url ?? null,
            photoZoom: a.players?.photo_zoom ?? null,
            photoOffsetX: a.players?.photo_offset_x ?? null,
            photoOffsetY: a.players?.photo_offset_y ?? null,
            teamName: equipo?.name ?? null,
            teamColor: equipo?.color ?? null,
            detail: a.detail,
          };
        })
        .sort(
          (a, b) =>
            ["mvp", "goleador", "valla", "fair_play"].indexOf(a.kind) -
            ["mvp", "goleador", "valla", "fair_play"].indexOf(b.kind),
        ),
    };
  });
}

/** Torneos terminados con su campeón, su podio y sus premios.
 *
 *  Cacheado con la misma etiqueta que el resto: cambia cuando se cierra
 *  un torneo, o sea casi nunca. */
const palmaresCacheado = unstable_cache(cargarPalmares, ["palmares"], {
  tags: [TAG_TORNEO],
  revalidate: 3600,
});

export async function getHistory(): Promise<TournamentHistory[]> {
  try {
    return await palmaresCacheado();
  } catch (error) {
    // El catch va FUERA del caché a propósito. Adentro, una lista vacía
    // por un fallo de red se guardaría como si fuera la respuesta buena
    // y se quedaría una hora —y en el home, que es estático, horneada en
    // el HTML—. Afuera, la sección no se dibuja en ESE render y el
    // siguiente lo vuelve a intentar.
    console.error("Error cargando el palmarés:", error);
    return [];
  }
}
