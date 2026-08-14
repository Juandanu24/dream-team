import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type Match,
  type MatchEvent,
  type Player,
  type Team,
  type TeamPlayer,
} from "@/lib/types";

// Datos compartidos por los dos módulos del admin: Calendario y
// Resultados. Ambos necesitan equipos y partidos; Resultados además
// necesita las plantillas y los eventos.

export interface RosterEntry extends TeamPlayer {
  players: Player;
}

export interface EventWithPlayer extends MatchEvent {
  players: Pick<Player, "full_name">;
}

export interface AdminMatchesData {
  teams: Team[];
  matches: Match[];
  roster: RosterEntry[];
  events: EventWithPlayer[];
}

export async function getAdminMatchesData(): Promise<AdminMatchesData | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const [teams, matches, roster, events] = await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("created_at"),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("week")
        .order("kickoff_at", { nullsFirst: false }),
      supabase
        .from("team_players")
        .select("*, players(*)")
        .eq("tournament_id", tournament.id),
      supabase
        .from("match_events")
        .select("*, players(full_name)")
        .order("created_at"),
    ]);

    return {
      teams: (teams.data as Team[]) ?? [],
      matches: (matches.data as Match[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      events: (events.data as unknown as EventWithPlayer[]) ?? [],
    };
  } catch (error) {
    console.error("Error cargando partidos:", error);
    return null;
  }
}

/** timestamptz → valor de <input type="datetime-local"> en hora de Colombia. */
export function toBogotaInput(ts: string | null): string {
  if (!ts) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
