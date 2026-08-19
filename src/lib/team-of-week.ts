import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type LineupLine,
  type Match,
  type Player,
  type Team,
  type TeamOfWeek,
  type TeamOfWeekPlayer,
} from "@/lib/types";

export interface TotwEntry extends TeamOfWeekPlayer {
  full_name: string;
  photo_url: string | null;
  team_id: string | null;
}

export interface TeamOfWeekWithPlayers extends TeamOfWeek {
  entries: TotwEntry[];
}

export interface TotwCandidate {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  isGoalkeeper: boolean;
}

export interface TotwData {
  teams: Team[];
  matches: Match[];
  /** Jugadores con equipo, para armar el once. */
  roster: {
    player_id: string;
    team_id: string;
    is_goalkeeper: boolean;
    players: Player;
  }[];
  weeks: TeamOfWeekWithPlayers[];
}

export async function getTeamOfWeekData(): Promise<TotwData | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const [teams, matches, roster, weeks] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournament.id).order("name"),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("kickoff_at"),
      supabase
        .from("team_players")
        .select("player_id, team_id, is_goalkeeper, players(*)")
        .eq("tournament_id", tournament.id),
      supabase
        .from("team_of_week")
        .select("*, team_of_week_players(*, players(full_name, photo_url))")
        .eq("tournament_id", tournament.id),
    ]);

    return {
      teams: (teams.data as Team[]) ?? [],
      matches: (matches.data as Match[]) ?? [],
      roster: (roster.data as unknown as TotwData["roster"]) ?? [],
      weeks: normalizar(weeks.data),
    };
  } catch (error) {
    console.error("Error cargando el once ideal:", error);
    return null;
  }
}

/** Once ideal publicado de una semana, para la vista pública. */
export async function getPublishedTeamsOfWeek(
  tournamentId: string,
): Promise<TeamOfWeekWithPlayers[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("team_of_week")
      .select("*, team_of_week_players(*, players(full_name, photo_url))")
      .eq("tournament_id", tournamentId)
      .not("published_at", "is", null);
    return normalizar(data);
  } catch {
    // Si la migración 00011 todavía no corrió, la vista pública sigue
    // funcionando sin la sección del once ideal.
    return [];
  }
}

type RawTotw = TeamOfWeek & {
  team_of_week_players: (TeamOfWeekPlayer & {
    players: { full_name: string; photo_url: string | null } | null;
  })[];
};

const ORDEN: Record<LineupLine, number> = { gk: 0, def: 1, mid: 2, fwd: 3 };

function normalizar(data: unknown): TeamOfWeekWithPlayers[] {
  const rows = (data as RawTotw[] | null) ?? [];
  return rows.map((row) => {
    const { team_of_week_players, ...totw } = row;
    return {
      ...totw,
      entries: (team_of_week_players ?? [])
        .map((e) => ({
          ...e,
          full_name: e.players?.full_name ?? "—",
          photo_url: e.players?.photo_url ?? null,
          team_id: null,
        }))
        .sort(
          (a, b) => ORDEN[a.line] - ORDEN[b.line] || a.slot - b.slot,
        ),
    };
  });
}
