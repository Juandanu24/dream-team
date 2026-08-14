"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_SLUG, type MatchStage } from "@/lib/types";

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateMatches() {
  revalidatePath("/admin/partidos");
  revalidatePath("/admin");
}

async function activeTournamentId() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", ACTIVE_TOURNAMENT_SLUG)
    .maybeSingle();
  if (!data) throw new Error("Torneo activo no encontrado");
  return data.id;
}

// Interpreta un valor de <input type="datetime-local"> como hora de Colombia.
function bogotaToIso(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString();
}

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

// Genera las 5 semanas del torneo a partir del martes de la semana 1.
// Cruces de grupos según el orden de creación de los equipos (1-4, como el flyer);
// semis y finales quedan sin equipos hasta que termine la fase de grupos.
export async function generateFixture(formData: FormData) {
  await requireAdmin();

  const firstTuesday = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .parse(formData.get("first_tuesday"));

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const [{ data: teams }, { count: existing }] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("tournament_id", tournamentId)
      .order("created_at"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
  ]);

  if ((teams?.length ?? 0) !== 4) {
    throw new Error("Se necesitan exactamente 4 equipos para generar el fixture");
  }
  if ((existing ?? 0) > 0) {
    throw new Error("Ya hay partidos creados; borra el fixture primero");
  }

  const t = teams!.map((team) => team.id);
  const groupPairings: [number, number][][] = [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ];

  // Martes 8:00 PM; jueves = martes + 2 días + 1 hora (9:00 PM).
  const week1Tuesday = new Date(`${firstTuesday}T20:00:00-05:00`).getTime();
  const tuesdayOf = (week: number) =>
    new Date(week1Tuesday + (week - 1) * 7 * DAYS);
  const thursdayOf = (week: number) =>
    new Date(week1Tuesday + (week - 1) * 7 * DAYS + 2 * DAYS + 1 * HOURS);

  type NewMatch = {
    tournament_id: string;
    stage: MatchStage;
    week: number;
    kickoff_at: string;
    home_team_id: string | null;
    away_team_id: string | null;
  };

  const matches: NewMatch[] = [];

  groupPairings.forEach((pairings, i) => {
    const week = i + 1;
    const [tue, thu] = pairings;
    matches.push(
      {
        tournament_id: tournamentId,
        stage: "group",
        week,
        kickoff_at: tuesdayOf(week).toISOString(),
        home_team_id: t[tue[0]],
        away_team_id: t[tue[1]],
      },
      {
        tournament_id: tournamentId,
        stage: "group",
        week,
        kickoff_at: thursdayOf(week).toISOString(),
        home_team_id: t[thu[0]],
        away_team_id: t[thu[1]],
      },
    );
  });

  matches.push(
    {
      tournament_id: tournamentId,
      stage: "semifinal",
      week: 4,
      kickoff_at: tuesdayOf(4).toISOString(),
      home_team_id: null,
      away_team_id: null,
    },
    {
      tournament_id: tournamentId,
      stage: "semifinal",
      week: 4,
      kickoff_at: thursdayOf(4).toISOString(),
      home_team_id: null,
      away_team_id: null,
    },
    {
      tournament_id: tournamentId,
      stage: "third_place",
      week: 5,
      kickoff_at: tuesdayOf(5).toISOString(),
      home_team_id: null,
      away_team_id: null,
    },
    {
      tournament_id: tournamentId,
      stage: "final",
      week: 5,
      kickoff_at: thursdayOf(5).toISOString(),
      home_team_id: null,
      away_team_id: null,
    },
  );

  const { error } = await supabase.from("matches").insert(matches);
  if (error) throw error;

  revalidateMatches();
}

// Borra todos los partidos del torneo (solo si ninguno está finalizado).
export async function deleteFixture() {
  await requireAdmin();
  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("status", "finished");
  if ((count ?? 0) > 0) {
    throw new Error("Hay partidos finalizados; no se puede borrar el fixture");
  }

  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (error) throw error;

  revalidateMatches();
}

// Edita fecha/hora y (en fases finales) los equipos del cruce.
export async function updateMatch(matchId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const kickoffLocal = String(formData.get("kickoff_at") ?? "");
  const home = String(formData.get("home_team_id") ?? "");
  const away = String(formData.get("away_team_id") ?? "");

  if (home && away && home === away) {
    throw new Error("Un equipo no puede jugar contra sí mismo");
  }

  const update: Record<string, string | null> = {};
  if (kickoffLocal) update.kickoff_at = bogotaToIso(kickoffLocal);
  if (formData.has("home_team_id")) update.home_team_id = home || null;
  if (formData.has("away_team_id")) update.away_team_id = away || null;

  const { error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", matchId);
  if (error) throw error;

  revalidateMatches();
}

const scoreSchema = z.object({
  home_score: z.coerce.number().int().min(0).max(99),
  away_score: z.coerce.number().int().min(0).max(99),
});

export async function saveResult(matchId: string, formData: FormData) {
  await requireAdmin();
  const parsed = scoreSchema.parse({
    home_score: formData.get("home_score"),
    away_score: formData.get("away_score"),
  });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("matches")
    .update({ ...parsed, status: "finished" })
    .eq("id", matchId);
  if (error) throw error;

  revalidateMatches();
}

export async function reopenMatch(matchId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("matches")
    .update({ status: "scheduled" })
    .eq("id", matchId);
  if (error) throw error;

  revalidateMatches();
}

const eventSchema = z.object({
  type: z.enum(["goal", "assist", "yellow_card", "red_card"]),
  player_id: z.uuid(),
  minute: z.coerce.number().int().min(0).max(130).nullable(),
});

export async function addEvent(matchId: string, formData: FormData) {
  await requireAdmin();
  const minuteRaw = String(formData.get("minute") ?? "").trim();
  const parsed = eventSchema.parse({
    type: formData.get("type"),
    player_id: formData.get("player_id"),
    minute: minuteRaw === "" ? null : minuteRaw,
  });

  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, tournament_id, home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) throw new Error("Partido no encontrado");

  // El equipo del evento se deriva de la plantilla del jugador en este torneo.
  const { data: membership } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("tournament_id", match.tournament_id)
    .eq("player_id", parsed.player_id)
    .maybeSingle();
  if (
    !membership ||
    ![match.home_team_id, match.away_team_id].includes(membership.team_id)
  ) {
    throw new Error("El jugador no pertenece a los equipos de este partido");
  }

  const { error } = await supabase.from("match_events").insert({
    match_id: match.id,
    player_id: parsed.player_id,
    team_id: membership.team_id,
    type: parsed.type,
    minute: parsed.minute,
  });
  if (error) throw error;

  revalidateMatches();
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("match_events")
    .delete()
    .eq("id", eventId);
  if (error) throw error;

  revalidateMatches();
}
