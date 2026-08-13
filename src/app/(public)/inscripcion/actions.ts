"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

const registrationSchema = z.object({
  full_name: z.string().trim().min(3, "Nombre muy corto").max(80),
  email: z.email("Email inválido").trim().toLowerCase(),
  age: z.coerce.number().int().min(10, "Edad mínima 10").max(80, "Edad máxima 80"),
  dominant_foot: z.enum(["right", "left", "both"]),
  position: z.enum(["goalkeeper", "defender", "midfielder", "forward"]),
  member_since: z.string().trim().min(1, "Cuéntanos hace cuánto estás").max(40),
});

const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type RegistrationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitRegistration(
  formData: FormData,
): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    age: formData.get("age"),
    dominant_foot: formData.get("dominant_foot"),
    position: formData.get("position"),
    member_since: formData.get("member_since"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Revisa los datos del formulario" };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, error: "Falta la foto para tu carta" };
  }
  if (photo.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: "La foto quedó muy pesada, intenta con otra" };
  }
  const extension = EXTENSIONS[photo.type];
  if (!extension) {
    return { ok: false, error: "La foto debe ser JPG, PNG o WebP" };
  }

  try {
    const supabase = createAdminClient();

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, status")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();

    if (!tournament) {
      return { ok: false, error: "El torneo aún no está abierto, pregunta en el grupo" };
    }
    if (tournament.status !== "registration") {
      return { ok: false, error: "Las inscripciones ya están cerradas" };
    }

    // Subir la foto al bucket público.
    const photoPath = `${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("player-photos")
      .upload(photoPath, await photo.arrayBuffer(), { contentType: photo.type });

    if (uploadError) {
      return { ok: false, error: "No pudimos subir tu foto, intenta de nuevo" };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("player-photos").getPublicUrl(photoPath);

    // Si el email ya existe, se actualiza el perfil (sirve para próximos
    // torneos sin registrarse desde cero); si no, se crea el jugador.
    const { data: existing } = await supabase
      .from("players")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    let playerId: string;

    if (existing) {
      const { error } = await supabase
        .from("players")
        .update({ ...parsed.data, photo_url: publicUrl })
        .eq("id", existing.id);
      if (error) throw error;
      playerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("players")
        .insert({ ...parsed.data, photo_url: publicUrl })
        .select("id")
        .single();
      if (error) throw error;
      playerId = created.id;
    }

    const { data: registration } = await supabase
      .from("registrations")
      .select("id, status")
      .eq("player_id", playerId)
      .eq("tournament_id", tournament.id)
      .maybeSingle();

    if (registration) {
      return {
        ok: false,
        error:
          registration.status === "rejected"
            ? "Tu inscripción anterior fue rechazada, habla con los organizadores"
            : "Ya estás inscrito en este torneo 😎",
      };
    }

    const { error: registrationError } = await supabase
      .from("registrations")
      .insert({ player_id: playerId, tournament_id: tournament.id });
    if (registrationError) throw registrationError;

    return { ok: true };
  } catch (error) {
    console.error("Error en inscripción:", error);
    return {
      ok: false,
      error: "Algo falló guardando tu inscripción, intenta de nuevo en un momento",
    };
  }
}
