"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { ACTIVE_TOURNAMENT_SLUG, formationLines } from "@/lib/types";

// Ojo: un archivo "use server" solo puede exportar funciones async.
// Las constantes compartidas (formaciones, etiquetas) viven en types.ts.

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateLineups() {
  revalidatePath("/admin/alineaciones");
  revalidatePath("/admin/piezas");
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

const entrySchema = z.object({
  player_id: z.string().uuid(),
  line: z.enum(["gk", "def", "mid", "fwd"]),
  slot: z.coerce.number().int().min(0).max(7),
  is_starter: z.boolean(),
});

const saveSchema = z.object({
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  formation: z.string().regex(/^\d-\d-\d$/, "Formación inválida"),
  notes: z.string().max(280).nullable(),
  entries: z.array(entrySchema).max(24),
});

export type SaveLineupInput = z.infer<typeof saveSchema>;

/** Guarda (o crea) la alineación de un equipo. No notifica: eso es publicar. */
export async function saveLineup(input: SaveLineupInput): Promise<string> {
  await requireAdmin();
  const parsed = saveSchema.parse(input);

  const lines = formationLines(parsed.formation);
  if (lines.def + lines.mid + lines.fwd !== 8) {
    throw new Error("La formación debe sumar 8 jugadores de campo");
  }

  const starters = parsed.entries.filter((e) => e.is_starter);
  if (starters.length > 9) {
    throw new Error("Fútbol 9: máximo 9 titulares");
  }
  if (starters.filter((e) => e.line === "gk").length > 1) {
    throw new Error("Solo puede ir un arquero de titular");
  }
  // Dos titulares en la misma casilla harían fallar el índice único con
  // un error de Postgres ilegible; se atrapa antes.
  const casillas = new Set(starters.map((e) => `${e.line}:${e.slot}`));
  if (casillas.size !== starters.length) {
    throw new Error("Hay dos titulares en la misma posición");
  }

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { data: lineup, error: upsertError } = await supabase
    .from("lineups")
    .upsert(
      {
        tournament_id: tournamentId,
        match_id: parsed.matchId,
        team_id: parsed.teamId,
        formation: parsed.formation,
        notes: parsed.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id,team_id" },
    )
    .select("id")
    .single();
  if (upsertError) throw upsertError;

  // Se reemplaza la nómina entera: es más simple y más seguro que
  // calcular altas y bajas, y son pocas filas.
  const { error: deleteError } = await supabase
    .from("lineup_players")
    .delete()
    .eq("lineup_id", lineup.id);
  if (deleteError) throw deleteError;

  if (parsed.entries.length > 0) {
    const { error: insertError } = await supabase.from("lineup_players").insert(
      parsed.entries.map((entry) => ({
        lineup_id: lineup.id,
        player_id: entry.player_id,
        line: entry.line,
        slot: entry.is_starter ? entry.slot : 0,
        is_starter: entry.is_starter,
      })),
    );
    if (insertError) throw insertError;
  }

  revalidateLineups();
  return lineup.id;
}

/** Publica la alineación: la hace visible en la web y manda el push. */
export async function publishLineup(lineupId: string): Promise<number> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: lineup, error } = await supabase
    .from("lineups")
    .select("id, match_id, team_id, published_at, teams(name)")
    .eq("id", lineupId)
    .maybeSingle();
  if (error) throw error;
  if (!lineup) throw new Error("Alineación no encontrada");

  const teamName =
    (lineup as unknown as { teams: { name: string } | null }).teams?.name ??
    "el equipo";

  const yaPublicada = Boolean(lineup.published_at);

  const { error: updateError } = await supabase
    .from("lineups")
    .update({ published_at: new Date().toISOString() })
    .eq("id", lineupId);
  if (updateError) throw updateError;

  // Republicar una alineación editada no vuelve a notificar: el tag
  // agrupa la notificación, pero igual sonaría el teléfono de todos.
  let enviados = 0;
  if (!yaPublicada) {
    enviados = await sendPushToAll({
      title: `📋 Alineación de ${teamName}`,
      body: "Ya está la titular para el próximo partido. Míratela.",
      url: "/torneo?tab=calendario",
      tag: `alineacion-${lineupId}`,
    });
  }

  revalidateLineups();
  return enviados;
}

/** Vuelve la alineación a borrador: deja de verse en la web pública. */
export async function unpublishLineup(lineupId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lineups")
    .update({ published_at: null })
    .eq("id", lineupId);
  if (error) throw error;
  revalidateLineups();
}

export async function deleteLineup(lineupId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("lineups").delete().eq("id", lineupId);
  if (error) throw error;
  revalidateLineups();
}
