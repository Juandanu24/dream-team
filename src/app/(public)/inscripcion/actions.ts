"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

const registrationSchema = z.object({
  full_name: z.string().trim().min(3, "Nombre muy corto").max(80),
  // 20 caracteres es lo que cabe en la carta sin encogerse a ilegible.
  jersey_name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre para la camiseta")
    .max(20, "El nombre de la camiseta no puede pasar de 20 caracteres"),
  height_cm: z.coerce
    .number()
    .int()
    .min(120, "Revisa la estatura")
    .max(230, "Revisa la estatura"),
  email: z.email("Email inválido").trim().toLowerCase(),
  age: z.coerce.number().int().min(10, "Edad mínima 10").max(80, "Edad máxima 80"),
  dominant_foot: z.enum(["right", "left", "both"]),
  position: z.enum(["goalkeeper", "defender", "midfielder", "forward"]),
  member_since: z.string().trim().min(1, "Cuéntanos hace cuánto estás").max(40),
});

const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
// El comprobante no se comprime en el cliente —hay que poder leer el
// monto y la fecha— así que se le deja más margen.
const PROOF_MAX_BYTES = 6 * 1024 * 1024;

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
    jersey_name: formData.get("jersey_name"),
    height_cm: formData.get("height_cm"),
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

  // El comprobante es obligatorio: el torneo se cobra y el admin lo
  // revisa antes de aprobar.
  const proof = formData.get("payment_proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, error: "Falta el comprobante de pago" };
  }
  if (proof.size > PROOF_MAX_BYTES) {
    return { ok: false, error: "El comprobante quedó muy pesado, intenta con otro" };
  }
  const proofExtension = EXTENSIONS[proof.type];
  if (!proofExtension) {
    return { ok: false, error: "El comprobante debe ser JPG, PNG o WebP" };
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

    // Se comprueba ANTES de subir nada. Al revés —como estaba— una
    // segunda inscripción dejaba dos archivos huérfanos en los buckets
    // y encima le pisaba la foto del perfil al jugador antes de
    // descubrir que ya estaba inscrito.
    const { data: existing } = await supabase
      .from("players")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (existing) {
      const { data: yaInscrito } = await supabase
        .from("registrations")
        .select("status")
        .eq("player_id", existing.id)
        .eq("tournament_id", tournament.id)
        .maybeSingle();

      if (yaInscrito) {
        return {
          ok: false,
          error:
            yaInscrito.status === "rejected"
              ? "Tu inscripción anterior fue rechazada, habla con los organizadores"
              : "Ya estás inscrito en este torneo 😎",
        };
      }
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

    // El comprobante va a un bucket PRIVADO: ahí hay banco, monto y a
    // veces el número de cuenta de alguien. Solo se guarda la ruta; la
    // URL la firma el admin cuando va a mirarlo.
    const proofPath = `${randomUUID()}.${proofExtension}`;
    const { error: proofError } = await supabase.storage
      .from("payment-proofs")
      .upload(proofPath, await proof.arrayBuffer(), { contentType: proof.type });

    const limpiarSubidas = async () => {
      await supabase.storage.from("player-photos").remove([photoPath]);
      await supabase.storage.from("payment-proofs").remove([proofPath]);
    };

    if (proofError) {
      await supabase.storage.from("player-photos").remove([photoPath]);
      return { ok: false, error: "No pudimos subir tu comprobante, intenta de nuevo" };
    }

    // Si el email ya existe, se actualiza el perfil (sirve para próximos
    // torneos sin registrarse desde cero); si no, se crea el jugador.
    let playerId: string;

    if (existing) {
      const { error } = await supabase
        .from("players")
        .update({ ...parsed.data, photo_url: publicUrl })
        .eq("id", existing.id);
      if (error) {
        await limpiarSubidas();
        throw error;
      }
      playerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("players")
        .insert({ ...parsed.data, photo_url: publicUrl })
        .select("id")
        .single();
      if (error) {
        await limpiarSubidas();
        throw error;
      }
      playerId = created.id;
    }

    const { error: registrationError } = await supabase
      .from("registrations")
      .insert({
        player_id: playerId,
        tournament_id: tournament.id,
        payment_proof_path: proofPath,
      });
    if (registrationError) {
      await limpiarSubidas();
      throw registrationError;
    }

    return { ok: true };
  } catch (error) {
    console.error("Error en inscripción:", error);
    return {
      ok: false,
      error: "Algo falló guardando tu inscripción, intenta de nuevo en un momento",
    };
  }
}
