import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type GroupStandingRow,
  type Match,
  type MatchEvent,
  type PenaltyLeaderboardRow,
  type Player,
  type PlayerCardsRow,
  type RegistrationStatus,
  type Team,
  type TeamPlayer,
  type TopAssistRow,
  type TopScorerRow,
  type Tournament,
  type TournamentStatus,
} from "@/lib/types";

export interface RosterEntry extends TeamPlayer {
  players: Player;
}

export interface EventWithPlayer extends MatchEvent {
  players: Pick<Player, "full_name">;
}

export interface TournamentData {
  tournament: Tournament;
  standings: GroupStandingRow[];
  teams: Team[];
  roster: RosterEntry[];
  /** Jugadores con inscripción aprobada (tengan equipo o no). */
  approvedPlayers: Player[];
  /** Conteo de inscripciones por estado (para el panel admin). */
  registrations: { pending: number; approved: number; rejected: number };
  matches: Match[];
  events: EventWithPlayer[];
  scorers: TopScorerRow[];
  assists: TopAssistRow[];
  cards: PlayerCardsRow[];
  penaltyLeaderboard: PenaltyLeaderboardRow[];
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

    const [
      standings,
      teams,
      roster,
      approved,
      matches,
      scorers,
      assists,
      cards,
      penalties,
    ] = await Promise.all([
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
          .from("registrations")
          .select("status, players(*)")
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
          .from("top_assists")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("assists", { ascending: false }),
        supabase
          .from("player_cards")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order("red_cards", { ascending: false })
          .order("yellow_cards", { ascending: false }),
        supabase
          .from("penalty_leaderboard")
          .select("*")
          .eq("tournament_id", tournament.id),
      ]);

    // Desempate estilo FIFA: puntos → diferencia de gol → goles a favor →
    // fair play (amarilla 1, roja 3; menos es mejor) → orden alfabético.
    const fairPlay = (row: GroupStandingRow) =>
      (row.yellow_cards ?? 0) + (row.red_cards ?? 0) * 3;
    const sortedStandings = ((standings.data as GroupStandingRow[]) ?? []).sort(
      (a, b) =>
        b.points - a.points ||
        b.goal_diff - a.goal_diff ||
        b.goals_for - a.goals_for ||
        fairPlay(a) - fairPlay(b) ||
        a.team_name.localeCompare(b.team_name),
    );

    const registrationRows =
      (approved.data as unknown as
        | { status: RegistrationStatus; players: Player }[]
        | null) ?? [];
    const matchRows = (matches.data as Match[]) ?? [];
    let events: EventWithPlayer[] = [];
    if (matchRows.length > 0) {
      const { data: eventRows } = await supabase
        .from("match_events")
        .select("*, players(full_name)")
        .in(
          "match_id",
          matchRows.map((m) => m.id),
        )
        .order("minute", { nullsFirst: false });
      events = (eventRows as unknown as EventWithPlayer[]) ?? [];
    }

    return {
      tournament: tournament as Tournament,
      standings: sortedStandings,
      teams: (teams.data as Team[]) ?? [],
      roster: (roster.data as unknown as RosterEntry[]) ?? [],
      approvedPlayers: registrationRows
        .filter((r) => r.status === "approved")
        .map((r) => r.players)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      registrations: {
        pending: registrationRows.filter((r) => r.status === "pending").length,
        approved: registrationRows.filter((r) => r.status === "approved").length,
        rejected: registrationRows.filter((r) => r.status === "rejected").length,
      },
      matches: matchRows,
      events,
      scorers: (scorers.data as TopScorerRow[]) ?? [],
      assists: (assists.data as TopAssistRow[]) ?? [],
      cards: (cards.data as PlayerCardsRow[]) ?? [],
      penaltyLeaderboard: sortLeaderboard(
        (penalties.data as PenaltyLeaderboardRow[]) ?? [],
      ),
    };
  } catch (error) {
    console.error("Error cargando datos del torneo:", error);
    return null;
  }
}

// Estado del torneo activo. Si Supabase no responde asumimos abierto,
// para no bloquear inscripciones por un problema de red.
export async function getTournamentStatus(): Promise<TournamentStatus> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("tournaments")
      .select("status")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    return (data?.status as TournamentStatus) ?? "registration";
  } catch {
    return "registration";
  }
}

// Datos del reto de penales: quiénes pueden patear y cómo va el ranking.
// Si la migración de penales aún no corrió, devuelve el ranking vacío.
export async function getPenaltyData(): Promise<{
  players: { id: string; name: string; photoUrl: string | null }[];
  leaderboard: PenaltyLeaderboardRow[];
}> {
  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return { players: [], leaderboard: [] };

    const [registrations, leaderboard] = await Promise.all([
      supabase
        .from("registrations")
        .select("players(id, full_name, photo_url)")
        .eq("tournament_id", tournament.id)
        .eq("status", "approved"),
      supabase
        .from("penalty_leaderboard")
        .select("*")
        .eq("tournament_id", tournament.id),
    ]);

    const players = (
      (registrations.data as unknown as
        | { players: Pick<Player, "id" | "full_name" | "photo_url"> }[]
        | null) ?? []
    )
      .map((row) => ({
        id: row.players.id,
        name: row.players.full_name,
        photoUrl: row.players.photo_url,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      players,
      leaderboard: sortLeaderboard(
        (leaderboard.data as PenaltyLeaderboardRow[]) ?? [],
      ),
    };
  } catch (error) {
    console.error("Error cargando datos de penales:", error);
    return { players: [], leaderboard: [] };
  }
}

// Mejor puntaje primero; a igual puntaje, gana quien lo logró en menos intentos.
export function sortLeaderboard(rows: PenaltyLeaderboardRow[]) {
  return [...rows].sort(
    (a, b) =>
      b.best_score - a.best_score ||
      a.attempts - b.attempts ||
      a.full_name.localeCompare(b.full_name),
  );
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
