"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

const teamSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
});

const CREST_MAX_BYTES = 2 * 1024 * 1024;

const CREST_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateTeams() {
  revalidatePath("/admin/equipos");
  revalidatePath("/admin");
  revalidatePath("/torneo");
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const parsed = teamSchema.parse({
    name: formData.get("name"),
    color: formData.get("color"),
  });

  const supabase = createAdminClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", ACTIVE_TOURNAMENT_SLUG)
    .maybeSingle();
  if (!tournament) throw new Error("Torneo activo no encontrado");

  const { error } = await supabase
    .from("teams")
    .insert({ ...parsed, tournament_id: tournament.id });
  if (error) throw error;

  revalidateTeams();
}

export async function updateTeam(teamId: string, formData: FormData) {
  await requireAdmin();
  const parsed = teamSchema.parse({
    name: formData.get("name"),
    color: formData.get("color"),
  });

  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").update(parsed).eq("id", teamId);
  if (error) throw error;

  revalidateTeams();
}

// Sube el escudo que pasa cada equipo. Sin escudo se usa el ícono
// por defecto (un escudo con el color del equipo).
export async function updateTeamCrest(teamId: string, formData: FormData) {
  await requireAdmin();
  const crest = formData.get("crest");

  if (!(crest instanceof File) || crest.size === 0) {
    throw new Error("Elige una imagen");
  }
  if (crest.size > CREST_MAX_BYTES) {
    throw new Error("La imagen pesa más de 2 MB");
  }
  const extension = CREST_EXTENSIONS[crest.type];
  if (!extension) {
    throw new Error("El escudo debe ser JPG, PNG, WebP o SVG");
  }

  const supabase = createAdminClient();
  const path = `${teamId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("team-crests")
    .upload(path, await crest.arrayBuffer(), { contentType: crest.type });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("team-crests").getPublicUrl(path);

  const { error } = await supabase
    .from("teams")
    .update({ crest_url: publicUrl })
    .eq("id", teamId);
  if (error) throw error;

  revalidateTeams();
}

export async function removeTeamCrest(teamId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teams")
    .update({ crest_url: null })
    .eq("id", teamId);
  if (error) throw error;

  revalidateTeams();
}

export async function deleteTeam(teamId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;

  revalidateTeams();
}

export async function assignPlayer(teamId: string, formData: FormData) {
  await requireAdmin();
  const playerId = String(formData.get("player_id") ?? "");
  if (!playerId) return;

  const supabase = createAdminClient();

  const [{ data: team }, { data: player }] = await Promise.all([
    supabase.from("teams").select("id, tournament_id").eq("id", teamId).maybeSingle(),
    supabase.from("players").select("id, position").eq("id", playerId).maybeSingle(),
  ]);
  if (!team || !player) throw new Error("Equipo o jugador no encontrado");

  const { error } = await supabase.from("team_players").insert({
    team_id: team.id,
    tournament_id: team.tournament_id,
    player_id: player.id,
    is_goalkeeper: player.position === "goalkeeper",
  });
  if (error) throw error;

  revalidateTeams();
}

export async function removePlayer(teamPlayerId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("team_players")
    .delete()
    .eq("id", teamPlayerId);
  if (error) throw error;

  revalidateTeams();
}
