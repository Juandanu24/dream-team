import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchWinner } from "@/lib/match-summary";
import { TAG_TORNEO } from "@/lib/data";
import type { Match, Team } from "@/lib/types";

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
  teamName: string | null;
  teamColor: string | null;
  /** La cifra con la que se entregó, congelada. */
  detail: string | null;
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
}

type AwardRow = {
  tournament_id: string;
  kind: AwardKind;
  detail: string | null;
  player_id: string;
  players: { full_name: string; photo_url: string | null } | null;
};

async function cargarPalmares(): Promise<TournamentHistory[]> {
  try {
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
      supabase
        .from("matches")
        .select("*")
        .in("tournament_id", ids)
        .in("stage", ["final", "third_place"])
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
        .select("*, players(full_name, photo_url)")
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

      return {
        slug: torneo.slug,
        name: torneo.name,
        champion: podium[0] ?? null,
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
  } catch (error) {
    console.error("Error cargando el palmarés:", error);
    return [];
  }
}

/** Torneos terminados con su campeón, su podio y sus premios.
 *
 *  Cacheado con la misma etiqueta que el resto: cambia cuando se cierra
 *  un torneo, o sea casi nunca. */
export const getHistory = unstable_cache(cargarPalmares, ["palmares"], {
  tags: [TAG_TORNEO],
  revalidate: 3600,
});
