"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { ACTIVE_TOURNAMENT_SLUG, formationLines } from "@/lib/types";

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateTotw() {
  revalidatePath("/admin/once-ideal");
  revalidatePath("/torneo");
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

const saveSchema = z.object({
  week: z.coerce.number().int().min(1).max(10),
  formation: z.string().regex(/^\d-\d-\d$/, "Formación inválida"),
  notes: z.string().max(280).nullable(),
  entries: z
    .array(
      z.object({
        player_id: z.string().uuid(),
        line: z.enum(["gk", "def", "mid", "fwd"]),
        slot: z.coerce.number().int().min(0).max(7),
      }),
    )
    .max(9),
});

export type SaveTotwInput = z.infer<typeof saveSchema>;

/** Guarda el once ideal de una semana. No notifica: eso es publicar. */
export async function saveTeamOfWeek(input: SaveTotwInput): Promise<string> {
  await requireAdmin();
  const parsed = saveSchema.parse(input);

  const lines = formationLines(parsed.formation);
  if (lines.def + lines.mid + lines.fwd !== 8) {
    throw new Error("La formación debe sumar 8 jugadores de campo");
  }
  if (parsed.entries.filter((e) => e.line === "gk").length > 1) {
    throw new Error("Solo puede ir un arquero");
  }
  // Dos en la misma casilla harían fallar el índice único con un error de
  // Postgres ilegible; se atrapa antes.
  const casillas = new Set(parsed.entries.map((e) => `${e.line}:${e.slot}`));
  if (casillas.size !== parsed.entries.length) {
    throw new Error("Hay dos jugadores en la misma posición");
  }

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { data: totw, error: upsertError } = await supabase
    .from("team_of_week")
    .upsert(
      {
        tournament_id: tournamentId,
        week: parsed.week,
        formation: parsed.formation,
        notes: parsed.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tournament_id,week" },
    )
    .select("id")
    .single();
  if (upsertError) throw upsertError;

  const { error: deleteError } = await supabase
    .from("team_of_week_players")
    .delete()
    .eq("totw_id", totw.id);
  if (deleteError) throw deleteError;

  if (parsed.entries.length > 0) {
    const { error: insertError } = await supabase
      .from("team_of_week_players")
      .insert(
        parsed.entries.map((e) => ({
          totw_id: totw.id,
          player_id: e.player_id,
          line: e.line,
          slot: e.slot,
        })),
      );
    if (insertError) throw insertError;
  }

  revalidateTotw();
  return totw.id;
}

/** Publica el once ideal: se ve en la web y sale el aviso. */
export async function publishTeamOfWeek(
  totwId: string,
  week: number,
  notify = true,
): Promise<number> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Se sella antes de notificar: sendPushToAll nunca lanza, así que el
  // peor caso es "publicado sin avisar" y no al revés.
  const { error } = await supabase
    .from("team_of_week")
    .update({ published_at: new Date().toISOString() })
    .eq("id", totwId);
  if (error) throw error;

  let enviados = 0;
  if (notify) {
    enviados = await sendPushToAll({
      title: `⭐ Once ideal de la semana ${week}`,
      body: "Ya está el equipo de la fecha. Mira si quedaste.",
      url: "/torneo?tab=calendario",
      tag: `once-ideal-${week}`,
    });
  }

  revalidateTotw();
  return enviados;
}

export async function unpublishTeamOfWeek(totwId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("team_of_week")
    .update({ published_at: null })
    .eq("id", totwId);
  if (error) throw error;
  revalidateTotw();
}
