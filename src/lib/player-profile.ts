import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  type Player,
  type Team,
} from "@/lib/types";

export interface PlayerProfile {
  player: Player;
  team: Team | null;
  isCaptain: boolean;
  isGoalkeeper: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  /** Mejor puntaje en el reto de penales; null si nunca jugó. */
  penaltyBest: number | null;
  /** Veces que fue figura del partido. */
  mvpCount: number;
}

/** Perfil público de un jugador en el torneo activo.
 *
 *  Devuelve null si el jugador no existe o no está inscrito en este
 *  torneo: la página es pública y no debe filtrar a nadie de otro lado. */
export async function getPlayerProfile(
  playerId: string,
): Promise<PlayerProfile | null> {
  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    // Solo los aprobados tienen página: un inscrito pendiente todavía no
    // es parte del torneo.
    const { data: registration } = await supabase
      .from("registrations")
      .select("status, players(*)")
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId)
      .eq("status", "approved")
      .maybeSingle();

    const player = (registration as unknown as { players: Player } | null)
      ?.players;
    if (!player) return null;

    const [membership, scorers, assists, cards, penalty, mvps] =
      await Promise.all([
        supabase
          .from("team_players")
          .select("is_captain, is_goalkeeper, teams(*)")
          .eq("tournament_id", tournament.id)
          .eq("player_id", playerId)
          .maybeSingle(),
        supabase
          .from("top_scorers")
          .select("goals")
          .eq("tournament_id", tournament.id)
          .eq("player_id", playerId)
          .maybeSingle(),
        supabase
          .from("top_assists")
          .select("assists")
          .eq("tournament_id", tournament.id)
          .eq("player_id", playerId)
          .maybeSingle(),
        supabase
          .from("player_cards")
          .select("yellow_cards, red_cards")
          .eq("tournament_id", tournament.id)
          .eq("player_id", playerId)
          .maybeSingle(),
        supabase
          .from("penalty_leaderboard")
          .select("best_score")
          .eq("tournament_id", tournament.id)
          .eq("player_id", playerId)
          .maybeSingle(),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", tournament.id)
          .eq("mvp_player_id", playerId),
      ]);

    const team =
      (membership.data as unknown as { teams: Team | null } | null)?.teams ??
      null;

    return {
      player,
      team,
      isCaptain: Boolean(membership.data?.is_captain),
      isGoalkeeper: Boolean(membership.data?.is_goalkeeper),
      goals: scorers.data?.goals ?? 0,
      assists: assists.data?.assists ?? 0,
      yellowCards: cards.data?.yellow_cards ?? 0,
      redCards: cards.data?.red_cards ?? 0,
      penaltyBest: penalty.data?.best_score ?? null,
      // Si la migración 00011 aún no corrió, la consulta falla y el
      // contador queda en 0 en vez de tumbar la página entera.
      mvpCount: mvps.count ?? 0,
    };
  } catch (error) {
    console.error("Error cargando el perfil del jugador:", error);
    return null;
  }
}

/** Ids de todos los jugadores aprobados, para enlazarlos desde /torneo. */
export async function getApprovedPlayerIds(): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return [];

    const { data } = await supabase
      .from("registrations")
      .select("player_id")
      .eq("tournament_id", tournament.id)
      .eq("status", "approved");
    return (data ?? []).map((r) => r.player_id as string);
  } catch {
    return [];
  }
}
