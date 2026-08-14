"use server";

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
