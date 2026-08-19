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
