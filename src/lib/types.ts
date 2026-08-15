// Tipos del dominio (espejo del schema en supabase/migrations).

export type DominantFoot = "right" | "left" | "both";
export type PlayerPosition = "goalkeeper" | "defender" | "midfielder" | "forward";
export type RegistrationStatus = "pending" | "approved" | "rejected";
export type TournamentStatus = "registration" | "in_progress" | "finished";
export type MatchStage = "group" | "semifinal" | "third_place" | "final";
export type MatchStatus = "scheduled" | "finished";
export type MatchEventType =
  | "goal"
  | "own_goal"
  | "assist"
  | "yellow_card"
  | "red_card";

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  created_at: string;
}

export interface Player {
  id: string;
  full_name: string;
  email: string;
  age: number;
  dominant_foot: DominantFoot;
  position: PlayerPosition;
  member_since: string;
  photo_url: string | null;
  created_at: string;
}

export interface Registration {
  id: string;
  player_id: string;
  tournament_id: string;
  status: RegistrationStatus;
  created_at: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  color: string | null;
  crest_url?: string | null;
  created_at: string;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  tournament_id: string;
  player_id: string;
  is_goalkeeper: boolean;
  /** Un solo capitán por equipo (garantizado por índice único). */
  is_captain?: boolean;
  jersey_number: number | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  stage: MatchStage;
  week: number;
  kickoff_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  created_at: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  type: MatchEventType;
  minute: number | null;
  created_at: string;
}

// Filas de las vistas calculadas.
export interface GroupStandingRow {
  tournament_id: string;
  team_id: string;
  team_name: string;
  team_color: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  /** Tarjetas de fase de grupos (fair play); 0 si la vista aún no migra. */
  yellow_cards?: number;
  red_cards?: number;
}

export interface TopScorerRow {
  tournament_id: string;
  player_id: string;
  full_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  team_color: string | null;
  goals: number;
}

export interface TopAssistRow {
  tournament_id: string;
  player_id: string;
  full_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  team_color: string | null;
  assists: number;
}

export interface PenaltyLeaderboardRow {
  tournament_id: string;
  player_id: string;
  full_name: string;
  photo_url: string | null;
  best_score: number;
  attempts: number;
  last_played_at: string;
}

export interface PlayerCardsRow {
  tournament_id: string;
  player_id: string;
  full_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  team_color: string | null;
  yellow_cards: number;
  red_cards: number;
}

// ---------- Etiquetas en español para la UI ----------

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: "Arquero",
  defender: "Defensa",
  midfielder: "Mediocampista",
  forward: "Delantero",
};

export const POSITION_SHORT: Record<PlayerPosition, string> = {
  goalkeeper: "ARQ",
  defender: "DEF",
  midfielder: "MED",
  forward: "DEL",
};

export const FOOT_LABELS: Record<DominantFoot, string> = {
  right: "Derecho",
  left: "Izquierdo",
  both: "Ambidiestro",
};

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: "Fase de grupos",
  semifinal: "Semifinal",
  third_place: "3º y 4º puesto",
  final: "Gran Final",
};

export const EVENT_LABELS: Record<MatchEventType, string> = {
  goal: "⚽ Gol",
  own_goal: "🥅 Autogol",
  assist: "🅰️ Asistencia",
  yellow_card: "🟨 Amarilla",
  red_card: "🟥 Roja",
};

export const EVENT_ICONS: Record<MatchEventType, string> = {
  goal: "⚽",
  own_goal: "🥅",
  assist: "🅰️",
  yellow_card: "🟨",
  red_card: "🟥",
};

export const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

// Slug del torneo activo (el que muestran la landing y la inscripción).
// Se puede apuntar a otro torneo con NEXT_PUBLIC_TOURNAMENT_SLUG, que es
// como se prueba en local sin tocar los datos del torneo real.
export const ACTIVE_TOURNAMENT_SLUG =
  process.env.NEXT_PUBLIC_TOURNAMENT_SLUG || "relampago-2026";
