import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type Lineup,
  type LineupPlayer,
  type Match,
  type Player,
  type Team,
  type TeamPlayer,
} from "@/lib/types";

export interface RosterEntry extends TeamPlayer {
  players: Player;
}

/** Una alineación con su gente ya resuelta a nombres. */
export interface LineupWithPlayers extends Lineup {
  entries: (LineupPlayer & { full_name: string; photo_url: string | null })[];
}

export interface LineupsData {
  tournamentId: string;
  teams: Team[];
  matches: Match[];
  roster: RosterEntry[];
  lineups: LineupWithPlayers[];
}

/** Todo lo que necesita el módulo de alineaciones del admin. */
export async function getLineupsData(): Promise<LineupsData | null> {
  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const [teams, matches, roster, lineups] = await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("name"),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("kickoff_at"),
      supabase
        .from("team_players")
        .select("*, players(*)")
        .eq("tournament_id", tournament.id),
      supabase
        .from("lineups")
        .select("*, lineup_players(*, players(full_name, photo_url))")
        .eq("tournament_id", tournament.id),
    ]);

    return {
      tournamentId: tournament.id,
      teams: (teams.data as Team[]) ?? [],
      matches: (matches.data as Match[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      lineups: normalizeLineups(lineups.data),
    };
  } catch (error) {
    console.error("Error cargando alineaciones:", error);
    return null;
  }
}

/** Alineaciones ya publicadas de un torneo, para la vista pública. */
export async function getPublishedLineups(
  tournamentId: string,
): Promise<LineupWithPlayers[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("lineups")
      .select("*, lineup_players(*, players(full_name, photo_url))")
      .eq("tournament_id", tournamentId)
      .not("published_at", "is", null);
    return normalizeLineups(data);
  } catch (error) {
    console.error("Error cargando alineaciones publicadas:", error);
    return [];
  }
}

// Supabase devuelve la relación anidada; la aplanamos a `entries` para
// que la UI no tenga que navegar dos niveles en cada render.
type RawLineup = Lineup & {
  lineup_players: (LineupPlayer & {
    players: { full_name: string; photo_url: string | null } | null;
  })[];
};

function normalizeLineups(data: unknown): LineupWithPlayers[] {
  const rows = (data as RawLineup[] | null) ?? [];
  return rows.map((row) => {
    const { lineup_players, ...lineup } = row;
    return {
      ...lineup,
      entries: (lineup_players ?? [])
        .map((entry) => ({
          ...entry,
          full_name: entry.players?.full_name ?? "—",
          photo_url: entry.players?.photo_url ?? null,
        }))
        // Titulares primero, después por línea y por posición en la línea.
        .sort(
          (a, b) =>
            Number(b.is_starter) - Number(a.is_starter) ||
            LINE_ORDER[a.line] - LINE_ORDER[b.line] ||
            a.slot - b.slot ||
            a.full_name.localeCompare(b.full_name),
        ),
    };
  });
}

const LINE_ORDER = { gk: 0, def: 1, mid: 2, fwd: 3 } as const;

/** Lo que recibió cada arquero: goles en contra y partidos atajados. */
export interface GkRecord {
  conceded: number;
  matches: number;
}

/** Valla menos vencida, cruzando quién atajó cada partido con los goles
 *  que recibió su equipo.
 *
 *  No hay una tabla de "arquero del partido": el dato sale de la
 *  alineación (`line = 'gk'` e `is_starter`). Por eso solo cuenta los
 *  partidos con alineación cargada — un partido sin ella no suma ni
 *  resta, que es preferible a inventarle un arquero. */
export async function getGoalkeeperRecords(
  tournamentId: string,
): Promise<Map<string, GkRecord>> {
  const salida = new Map<string, GkRecord>();
  try {
    const supabase = createAdminClient();
    const [matches, lineups] = await Promise.all([
      supabase
        .from("matches")
        .select("id, home_team_id, away_team_id, home_score, away_score, status")
        .eq("tournament_id", tournamentId)
        .eq("status", "finished"),
      supabase
        .from("lineups")
        .select("match_id, team_id, lineup_players(player_id, line, is_starter)")
        .eq("tournament_id", tournamentId),
    ]);

    const porId = new Map(
      ((matches.data as Match[]) ?? []).map((m) => [m.id, m]),
    );

    type Fila = {
      match_id: string;
      team_id: string;
      lineup_players: { player_id: string; line: string; is_starter: boolean }[];
    };

    for (const fila of ((lineups.data as unknown as Fila[]) ?? [])) {
      const match = porId.get(fila.match_id);
      if (!match) continue;
      const arquero = fila.lineup_players.find(
        (e) => e.line === "gk" && e.is_starter,
      );
      if (!arquero) continue;

      // Los goles que recibió son los del RIVAL en ese partido.
      const recibidos =
        fila.team_id === match.home_team_id ? match.away_score : match.home_score;
      if (recibidos === null) continue;

      const previo = salida.get(arquero.player_id) ?? { conceded: 0, matches: 0 };
      salida.set(arquero.player_id, {
        conceded: previo.conceded + recibidos,
        matches: previo.matches + 1,
      });
    }
  } catch (error) {
    console.error("Error calculando la valla menos vencida:", error);
  }
  return salida;
}
