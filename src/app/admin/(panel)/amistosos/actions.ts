"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { formationLines } from "@/lib/types";

// Los amistosos NO notifican por push ni salen en la web pública: son
// una herramienta del admin para armar el equipo y mandarlo al grupo.
// Los 8 suscritos lo son del torneo, y esto les llegaría como ruido.

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidarAmistosos() {
  revalidatePath("/admin/amistosos");
}

/** Sin la migración 00013 las tablas no existen y el error de PostgREST
 *  no le dice nada a nadie. */
function traducir(error: { code?: string; message: string }): Error {
  // PostgREST responde PGRST205 cuando la tabla no está en su cache;
  // 42P01 es el de Postgres. Se ven los dos según por dónde entre.
  if (error.code === "42P01" || error.code === "PGRST205") {
    return new Error("Falta correr la migración 00013 (amistosos).");
  }
  if (error.code === "23505") {
    return new Error(
      "Ese jugador ya está en el partido, o hay dos en la misma casilla.",
    );
  }
  return new Error(error.message);
}

// Interpreta un valor de <input type="datetime-local"> como hora de
// Colombia. Igual que en partidos/actions.ts: el input no trae zona y
// asumirla del servidor daría una hora distinta en Vercel.
function bogotaToIso(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString();
}

const crearSchema = z.object({
  title: z.string().trim().min(2, "Ponle un nombre").max(60),
  kickoffAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha inválida")
    .nullable(),
  venue: z.string().trim().max(80).nullable(),
  homeName: z.string().trim().min(1).max(40),
  awayName: z.string().trim().min(1).max(40),
  homeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  awayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

export type CrearAmistosoInput = z.infer<typeof crearSchema>;

/** Crea el amistoso con sus dos lados de una vez: un amistoso con un
 *  solo lado no sirve para nada, así que no se deja existir. */
export async function crearAmistoso(input: CrearAmistosoInput): Promise<string> {
  await requireAdmin();
  const p = crearSchema.parse(input);
  const supabase = createAdminClient();

  const { data: friendly, error } = await supabase
    .from("friendlies")
    .insert({
      title: p.title,
      kickoff_at: p.kickoffAt ? bogotaToIso(p.kickoffAt) : null,
      venue: p.venue,
    })
    .select("id")
    .single();
  if (error) throw traducir(error);

  const { error: sidesError } = await supabase.from("friendly_sides").insert([
    { friendly_id: friendly.id, name: p.homeName, color: p.homeColor, slot: 0 },
    { friendly_id: friendly.id, name: p.awayName, color: p.awayColor, slot: 1 },
  ]);
  if (sidesError) {
    // Sin sus dos lados el amistoso queda inservible; se limpia en vez
    // de dejar una fila huérfana que el admin no sabe qué hacer con ella.
    await supabase.from("friendlies").delete().eq("id", friendly.id);
    throw traducir(sidesError);
  }

  revalidarAmistosos();
  return friendly.id;
}

const entrySchema = z.object({
  player_id: z.string().uuid().nullable(),
  guest_name: z.string().trim().max(40).nullable(),
  line: z.enum(["gk", "def", "mid", "fwd"]),
  slot: z.coerce.number().int().min(0).max(7),
  is_starter: z.boolean(),
});

const guardarSchema = z.object({
  sideId: z.string().uuid(),
  friendlyId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  formation: z.string().regex(/^\d-\d-\d$/, "Formación inválida"),
  notes: z.string().max(280).nullable(),
  entries: z.array(entrySchema).max(24),
});

export type GuardarLadoInput = z.infer<typeof guardarSchema>;

/** Guarda un lado del amistoso: sus datos y su gente. */
export async function guardarLado(input: GuardarLadoInput): Promise<void> {
  await requireAdmin();
  const p = guardarSchema.parse(input);

  const lines = formationLines(p.formation);
  if (lines.def + lines.mid + lines.fwd !== 8) {
    throw new Error("La formación debe sumar 8 jugadores de campo");
  }

  const titulares = p.entries.filter((e) => e.is_starter);
  if (titulares.length > 9) throw new Error("Fútbol 9: máximo 9 titulares");
  if (titulares.filter((e) => e.line === "gk").length > 1) {
    throw new Error("Solo puede ir un arquero de titular");
  }
  // Se atrapan antes de que los índices únicos devuelvan un error de
  // Postgres que no dice dónde está el problema.
  const casillas = new Set(titulares.map((e) => `${e.line}:${e.slot}`));
  if (casillas.size !== titulares.length) {
    throw new Error("Hay dos titulares en la misma posición");
  }
  const deLaBase = p.entries
    .map((e) => e.player_id)
    .filter((id): id is string => Boolean(id));
  if (new Set(deLaBase).size !== deLaBase.length) {
    throw new Error("Hay un jugador repetido en este lado");
  }
  for (const e of p.entries) {
    if (!e.player_id && !e.guest_name) {
      throw new Error("Un invitado necesita nombre");
    }
  }

  const supabase = createAdminClient();

  const { error: sideError } = await supabase
    .from("friendly_sides")
    .update({
      name: p.name,
      color: p.color,
      formation: p.formation,
      notes: p.notes,
    })
    .eq("id", p.sideId);
  if (sideError) throw traducir(sideError);

  // Se reemplaza la nómina entera: más simple y más seguro que calcular
  // altas y bajas, y son pocas filas. Igual que en las alineaciones.
  const { error: deleteError } = await supabase
    .from("friendly_players")
    .delete()
    .eq("side_id", p.sideId);
  if (deleteError) throw traducir(deleteError);

  if (p.entries.length > 0) {
    const { error: insertError } = await supabase
      .from("friendly_players")
      .insert(
        p.entries.map((e) => ({
          side_id: p.sideId,
          friendly_id: p.friendlyId,
          player_id: e.player_id,
          guest_name: e.player_id ? null : e.guest_name,
          line: e.line,
          slot: e.is_starter ? e.slot : 0,
          is_starter: e.is_starter,
        })),
      );
    if (insertError) throw traducir(insertError);
  }

  await supabase
    .from("friendlies")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", p.friendlyId);

  revalidarAmistosos();
}

export async function borrarAmistoso(friendlyId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("friendlies")
    .delete()
    .eq("id", z.string().uuid().parse(friendlyId));
  if (error) throw traducir(error);
  revalidarAmistosos();
}
