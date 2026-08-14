"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

const statusSchema = z.enum(["registration", "in_progress", "finished"]);

// Abre o cierra las inscripciones y marca el torneo en juego / finalizado.
// Con estado distinto de "registration" el formulario público queda cerrado.
export async function updateTournamentStatus(formData: FormData) {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");

  const status = statusSchema.parse(formData.get("status"));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("slug", ACTIVE_TOURNAMENT_SLUG);
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/torneo");
  revalidatePath("/inscripcion");
}
