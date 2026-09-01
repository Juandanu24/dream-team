"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";

// El encuadre es del jugador, no de la pieza: se ajusta una vez y sirve
// para todas. Por eso vive en `players` y no en el estado del estudio,
// que se pierde al recargar.

const framingSchema = z.object({
  playerId: z.string().uuid(),
  zoom: z.coerce.number().min(1).max(3),
  x: z.coerce.number().min(-1).max(1),
  y: z.coerce.number().min(-1).max(1),
});

export type PhotoFramingInput = z.infer<typeof framingSchema>;

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

/** Sin la migración 00012 las columnas no existen y PostgREST responde
 *  con un error que no le dice nada a nadie. Vale la pena traducirlo. */
function traducir(message: string): Error {
  return /photo_zoom|photo_offset/.test(message)
    ? new Error("Falta correr la migración 00012 (encuadre de foto).")
    : new Error(message);
}

async function actualizar(
  playerId: string,
  valores: {
    photo_zoom: number | null;
    photo_offset_x: number | null;
    photo_offset_y: number | null;
  },
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("players")
    .update(valores)
    .eq("id", playerId);
  if (error) throw traducir(error.message);

  // Solo el estudio lee el encuadre por ahora. Revalidar /torneo sería
  // sugerir que allá cambia algo, y no cambia.
  revalidatePath("/admin/piezas");
}

/** Guarda cómo se recorta la foto de un jugador. */
export async function savePhotoFraming(input: PhotoFramingInput) {
  await requireAdmin();
  const { playerId, zoom, x, y } = framingSchema.parse(input);
  await actualizar(playerId, {
    photo_zoom: zoom,
    photo_offset_x: x,
    photo_offset_y: y,
  });
}

/** Vuelve la foto al encuadre por defecto de cada pieza. Es dejarla en
 *  nulo, no guardar el valor de arranque: así, si mañana se afina ese
 *  valor, las fotos sin ajustar lo heredan. */
export async function clearPhotoFraming(playerId: string) {
  await requireAdmin();
  await actualizar(z.string().uuid().parse(playerId), {
    photo_zoom: null,
    photo_offset_x: null,
    photo_offset_y: null,
  });
}
