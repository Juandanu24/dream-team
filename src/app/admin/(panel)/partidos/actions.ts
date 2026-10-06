"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAG_TORNEO } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidateMatches() {
  revalidatePath("/admin/partidos");
  revalidatePath("/admin/resultados");
  revalidatePath("/admin");
  revalidatePath("/torneo");
  // Los datos del torneo están cacheados. updateTag —y no
  // revalidateTag— porque expira de inmediato: el admin tiene que ver
  // su propio cambio, no una versión vieja mientras refresca por detrás.
  updateTag(TAG_TORNEO);
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

// Interpreta un valor de <input type="datetime-local"> como hora de Colombia.
function bogotaToIso(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString();
}

/** Un partido suelto de la fecha: su fase, cuándo se juega y el cruce.
 *  Los equipos son nulables porque un cruce "Por definir" es válido —en
 *  semifinales no se sabe quién clasifica hasta que termine la fase. */
const matchSchema = z.object({
  stage: z.enum(["group", "semifinal", "third_place", "final"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  home_team_id: z.string().uuid().nullable(),
  away_team_id: z.string().uuid().nullable(),
});

const weekSchema = z.object({
  // Hasta 20: con cuatro equipos sobraban diez fechas, pero un todos
  // contra todos de seis son quince partidos y el tope se alcanzaba.
  week: z.coerce.number().int().min(1).max(20),
  // Hasta 8 partidos: con dieciséis equipos una vuelta son ocho, y más
  // que eso no es una fecha, es un error de dedo.
  matches: z.array(matchSchema).min(1).max(8),
});

export type NuevoPartido = z.input<typeof matchSchema>;

// Programa una fecha: los partidos que sean, cada uno con su día y su
// hora.
//
// Antes programaba exactamente dos, el del martes y el del jueves, y el
// jueves lo calculaba sumándole dos días al martes. Con cuatro equipos
// eso era justo una vuelta completa; con seis son tres partidos y la
// forma del formulario se volvía el límite del torneo. Ahora la forma
// de la fecha la decide el formato, no el código.
//
// Las dos reglas que quedan son las que no dependen del formato: nadie
// juega dos veces en la misma fecha, y nadie juega contra sí mismo.
export async function addWeek(input: {
  week: number;
  matches: NuevoPartido[];
}) {
  await requireAdmin();

  const parsed = weekSchema.parse(input);

  for (const m of parsed.matches) {
    if (m.home_team_id && m.home_team_id === m.away_team_id) {
      throw new Error("Un equipo no puede jugar contra sí mismo");
    }
  }

  const elegidos = parsed.matches.flatMap((m) =>
    [m.home_team_id, m.away_team_id].filter((id): id is string => Boolean(id)),
  );
  if (new Set(elegidos).size !== elegidos.length) {
    throw new Error("Hay un equipo repetido: cada equipo juega una vez por fecha");
  }

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  // Ya no se bloquea una semana que tenga partidos: con un formato de
  // más equipos puede hacer falta sumarle uno después. Lo que había
  // antes impedía corregir sin borrar la fecha entera.
  const { error } = await supabase.from("matches").insert(
    parsed.matches.map((m) => ({
      tournament_id: tournamentId,
      stage: m.stage,
      week: parsed.week,
      kickoff_at: bogotaToIso(`${m.date}T${m.time}`),
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
    })),
  );
  if (error) throw error;

  revalidateMatches();
}

export async function deleteMatch(matchId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw error;

  revalidateMatches();
}

// Publica una semana: avisa a los suscritos con los cruces de esa
// semana y la marca como anunciada. Va aparte de crearla, para poder
// armarla y corregirla antes de que la vea todo el mundo.
export async function publishWeek(week: number): Promise<number> {
  await requireAdmin();

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, kickoff_at, home_team_id, away_team_id")
    .eq("tournament_id", tournamentId)
    .eq("week", week)
    .order("kickoff_at", { nullsFirst: false });

  if (!matches?.length) throw new Error(`La semana ${week} no tiene partidos`);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("tournament_id", tournamentId);
  const nameOf = (id: string | null) =>
    teams?.find((t) => t.id === id)?.name ?? "Por definir";

  const dia = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("es-CO", {
          weekday: "short",
          hour: "numeric",
          hour12: true,
          timeZone: "America/Bogota",
        }).format(new Date(iso))
      : "";

  const body = matches
    .map(
      (m) =>
        `${nameOf(m.home_team_id)} vs ${nameOf(m.away_team_id)}${
          m.kickoff_at ? ` (${dia(m.kickoff_at)})` : ""
        }`,
    )
    .join(" · ");

  const enviados = await sendPushToAll({
    title: `📅 Semana ${week} programada`,
    body,
    url: "/torneo?tab=calendario",
    tag: `semana-${week}`,
  });

  const { error } = await supabase
    .from("matches")
    .update({ announced_at: new Date().toISOString() })
    .eq("tournament_id", tournamentId)
    .eq("week", week);
  if (error) throw error;

  revalidateMatches();
  return enviados;
}

// Borra todos los partidos del torneo, incluidos resultados y eventos
// (los match_events caen en cascada). Útil para regenerar el fixture.
export async function deleteFixture() {
  await requireAdmin();
  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (error) throw error;

  revalidateMatches();
}

// Edita fecha/hora y (en fases finales) los equipos del cruce.
export async function updateMatch(matchId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const kickoffLocal = String(formData.get("kickoff_at") ?? "");
  const home = String(formData.get("home_team_id") ?? "");
  const away = String(formData.get("away_team_id") ?? "");

  if (home && away && home === away) {
    throw new Error("Un equipo no puede jugar contra sí mismo");
  }

  const update: Record<string, string | null> = {};
  if (kickoffLocal) update.kickoff_at = bogotaToIso(kickoffLocal);
  if (formData.has("home_team_id")) update.home_team_id = home || null;
  if (formData.has("away_team_id")) update.away_team_id = away || null;

  const { error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", matchId);
  if (error) throw error;

  revalidateMatches();
}
