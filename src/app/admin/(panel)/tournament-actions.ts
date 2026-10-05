"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAG_TORNEO } from "@/lib/data";
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
  // Los datos del torneo están cacheados. updateTag —y no
  // revalidateTag— porque expira de inmediato: el admin tiene que ver
  // su propio cambio, no una versión vieja mientras refresca por detrás.
  updateTag(TAG_TORNEO);
  revalidatePath("/inscripcion");
}
