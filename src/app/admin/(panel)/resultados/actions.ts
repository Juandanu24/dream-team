"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";

// Acciones del módulo de Resultados: marcador, goles, asistencias y
// tarjetas. La programación del calendario vive en partidos/actions.

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateMatches() {
  revalidatePath("/admin/resultados");
  revalidatePath("/admin/partidos");
  revalidatePath("/admin");
  revalidatePath("/torneo");
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
  const { data: before } = await supabase
    .from("matches")
    .select("status, home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle();

  const { error } = await supabase
    .from("matches")
    .update({ ...parsed, status: "finished" })
    .eq("id", matchId);
  if (error) throw error;

  // Solo avisamos la primera vez que se marca como jugado, para no
  // notificar cada corrección del marcador.
  if (before && before.status !== "finished") {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in(
        "id",
        [before.home_team_id, before.away_team_id].filter(
          (id): id is string => Boolean(id),
        ),
      );
    const nameOf = (id: string | null) =>
      teams?.find((t) => t.id === id)?.name ?? "Por definir";

    await sendPushToAll({
      title: "⚽ Resultado del Dream Team",
      body: `${nameOf(before.home_team_id)} ${parsed.home_score} - ${parsed.away_score} ${nameOf(before.away_team_id)}`,
      url: "/torneo?tab=posiciones",
      tag: "resultado",
    });
  }

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
  type: z.enum(["goal", "own_goal", "assist", "yellow_card", "red_card"]),
  player_id: z.uuid(),
  // Cuántas veces registrar el evento (p. ej. un jugador que marcó 3).
  count: z.coerce.number().int().min(1).max(20),
});

export async function addEvent(matchId: string, formData: FormData) {
  await requireAdmin();
  const parsed = eventSchema.parse({
    type: formData.get("type"),
    player_id: formData.get("player_id"),
    count: formData.get("count") || 1,
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

  const { error } = await supabase.from("match_events").insert(
    Array.from({ length: parsed.count }, () => ({
      match_id: match.id,
      player_id: parsed.player_id,
      team_id: membership.team_id,
      type: parsed.type,
    })),
  );
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

/** Elige (o quita) la figura del partido.
 *
 *  No sale de una fórmula a propósito: el que más corrió o el que salvó
 *  bajo palos no aparece en ninguna estadística, así que lo escoge el
 *  admin a dedo. `null` la quita. */
export async function setMatchMvp(
  matchId: string,
  playerId: string | null,
): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("matches")
    .update({ mvp_player_id: playerId })
    .eq("id", matchId);
  if (error) throw error;
  revalidateMatches();
}
