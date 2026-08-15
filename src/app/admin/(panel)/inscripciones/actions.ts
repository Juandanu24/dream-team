"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import type { RegistrationStatus } from "@/lib/types";

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateRegistrations() {
  revalidatePath("/admin/inscripciones");
  revalidatePath("/admin");
}

async function setRegistrationStatus(id: string, status: RegistrationStatus) {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", id);
  if (error) throw error;

  revalidateRegistrations();
}

export async function approveRegistration(id: string) {
  await setRegistrationStatus(id, "approved");
}

export async function rejectRegistration(id: string) {
  await setRegistrationStatus(id, "rejected");
}

export async function resetRegistration(id: string) {
  await setRegistrationStatus(id, "pending");
}

// Elimina la solicitud (y saca al jugador del equipo si estaba asignado).
// El jugador como tal se conserva para torneos futuros.
export async function deleteRegistration(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: registration } = await supabase
    .from("registrations")
    .select("player_id, tournament_id")
    .eq("id", id)
    .maybeSingle();
  if (!registration) return;

  const { error: teamError } = await supabase
    .from("team_players")
    .delete()
    .eq("tournament_id", registration.tournament_id)
    .eq("player_id", registration.player_id);
  if (teamError) throw teamError;

  const { error } = await supabase.from("registrations").delete().eq("id", id);
  if (error) throw error;

  revalidateRegistrations();
}

const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Cambia la foto de un jugador desde el admin, sin que tenga que
// reinscribirse. La foto anterior se reemplaza por una ruta nueva.
export async function updatePlayerPhoto(playerId: string, formData: FormData) {
  await requireAdmin();

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Elige una foto");
  }
  if (photo.size > PHOTO_MAX_BYTES) {
    throw new Error("La foto quedó muy pesada");
  }
  const extension = PHOTO_EXTENSIONS[photo.type];
  if (!extension) {
    throw new Error("La foto debe ser JPG, PNG o WebP");
  }

  const supabase = createAdminClient();
  const path = `${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("player-photos")
    .upload(path, await photo.arrayBuffer(), { contentType: photo.type });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("player-photos").getPublicUrl(path);

  const { error } = await supabase
    .from("players")
    .update({ photo_url: publicUrl })
    .eq("id", playerId);
  if (error) throw error;

  revalidateRegistrations();
  revalidatePath("/admin/equipos");
  revalidatePath("/torneo");
}

const playerSchema = z.object({
  full_name: z.string().trim().min(3, "Nombre muy corto").max(80),
  age: z.coerce.number().int().min(10).max(80),
  dominant_foot: z.enum(["right", "left", "both"]),
  position: z.enum(["goalkeeper", "defender", "midfielder", "forward"]),
  member_since: z.string().trim().min(1).max(40),
});

// Edita los datos de la carta del jugador (la foto se cambia
// re-inscribiéndose con el mismo email).
export async function updatePlayer(playerId: string, formData: FormData) {
  await requireAdmin();
  const parsed = playerSchema.parse({
    full_name: formData.get("full_name"),
    age: formData.get("age"),
    dominant_foot: formData.get("dominant_foot"),
    position: formData.get("position"),
    member_since: formData.get("member_since"),
  });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("players")
    .update(parsed)
    .eq("id", playerId);
  if (error) throw error;

  revalidateRegistrations();
  revalidatePath("/admin/equipos");
}
