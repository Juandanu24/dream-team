"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";
import { SHOTS_PER_ROUND } from "@/lib/penalty-game";

const scoreSchema = z.object({
  playerId: z.uuid(),
  score: z.number().int().min(0).max(SHOTS_PER_ROUND),
});

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

// Guarda el intento en el ranking. El puntaje viene del navegador, así
// que solo validamos que sea posible y que el jugador esté aprobado en
// el torneo activo: alcanza para un reto entre amigos.
export async function savePenaltyScore(
  playerId: string,
  score: number,
): Promise<SaveScoreResult> {
  const parsed = scoreSchema.safeParse({ playerId, score });
  if (!parsed.success) {
    return { ok: false, error: "Puntaje inválido" };
  }

  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) {
      return { ok: false, error: "El torneo no está disponible" };
    }

    const { data: registration } = await supabase
      .from("registrations")
      .select("id")
      .eq("tournament_id", tournament.id)
      .eq("player_id", parsed.data.playerId)
      .eq("status", "approved")
      .maybeSingle();
    if (!registration) {
      return { ok: false, error: "Ese jugador no está aprobado en el torneo" };
    }

    const { error } = await supabase.from("penalty_scores").insert({
      tournament_id: tournament.id,
      player_id: parsed.data.playerId,
      score: parsed.data.score,
      shots: SHOTS_PER_ROUND,
    });
    if (error) throw error;

    revalidatePath("/penales");
    revalidatePath("/torneo");
    return { ok: true };
  } catch (error) {
    console.error("Error guardando puntaje de penales:", error);
    return { ok: false, error: "No pudimos guardar tu puntaje" };
  }
}
