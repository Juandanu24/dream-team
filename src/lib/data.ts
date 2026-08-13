import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type GroupStandingRow,
  type Match,
  type Player,
  type PlayerCardsRow,
  type Team,
  type TeamPlayer,
  type TopScorerRow,
  type Tournament,
} from "@/lib/types";

export interface RosterEntry extends TeamPlayer {
  players: Player;
}

export interface TournamentData {
  tournament: Tournament;
  standings: GroupStandingRow[];
  teams: Team[];
  roster: RosterEntry[];
  matches: Match[];
  scorers: TopScorerRow[];
  cards: PlayerCardsRow[];
}

// Todo lo que necesita la página pública del torneo, en un solo viaje.
// Devuelve null si Supabase no está configurado o el torneo no existe.
export async function getTournamentData(): Promise<TournamentData | null> {
  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();

    if (!tournament) return null;

    const [standings, teams, roster, matches, scorers, cards] =
      await Promise.all([
        supabase
          .from("group_standings")
          .select("*")
          .eq("tournament_id", tournament.id),
        supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("name"),
        supabase
          .from("team_players")
          .select("*, players(*)")
          .eq("tournament_id", tournament.id),
        supabase
          .from("matches")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("week")
          .order("kickoff_at", { nullsFirst: false }),
        supabase
          .from("top_scorers")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("goals", { ascending: false }),
        supabase
          .from("player_cards")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("red_cards", { ascending: false })
          .order("yellow_cards", { ascending: false }),
      ]);

    const sortedStandings = ((standings.data as GroupStandingRow[]) ?? []).sort(
      (a, b) =>
        b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for,
    );

    return {
      tournament: tournament as Tournament,
      standings: sortedStandings,
      teams: (teams.data as Team[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      matches: (matches.data as Match[]) ?? [],
      scorers: (scorers.data as TopScorerRow[]) ?? [],
      cards: (cards.data as PlayerCardsRow[]) ?? [],
    };
  } catch (error) {
    console.error("Error cargando datos del torneo:", error);
    return null;
  }
}

export function formatKickoff(kickoffAt: string | null): string | null {
  if (!kickoffAt) return null;
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(new Date(kickoffAt));
}
