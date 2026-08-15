"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  revalidatePath("/admin");
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

const weekSchema = z.object({
  week: z.coerce.number().int().min(1).max(10),
  // group: dos partidos de grupos · semifinal: las dos semis
  // finals: martes 3º y 4º puesto, jueves la final
  mode: z.enum(["group", "semifinal", "finals"]),
  tuesday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  tuesday_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  thursday_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
});

const STAGES_BY_MODE = {
  group: ["group", "group"],
  semifinal: ["semifinal", "semifinal"],
  finals: ["third_place", "final"],
} as const;

// Programa una semana completa: el partido del martes y el del jueves.
// Valida que los cuatro equipos sean distintos, que es lo que garantiza
// que todos jueguen una vez en la semana.
export async function addWeek(formData: FormData) {
  await requireAdmin();

  const parsed = weekSchema.parse({
    week: formData.get("week"),
    mode: formData.get("mode"),
    tuesday: formData.get("tuesday"),
    tuesday_time: formData.get("tuesday_time"),
    thursday_time: formData.get("thursday_time"),
  });

  const ids = ["tue_home", "tue_away", "thu_home", "thu_away"].map(
    (field) => String(formData.get(field) ?? "") || null,
  );

  const elegidos = ids.filter((id): id is string => Boolean(id));
  if (new Set(elegidos).size !== elegidos.length) {
    throw new Error("Hay un equipo repetido: cada equipo juega una vez por semana");
  }
  if (parsed.mode === "group" && elegidos.length !== 4) {
    throw new Error("En fase de grupos hay que asignar los cuatro equipos");
  }

  const supabase = createAdminClient();
  const tournamentId = await activeTournamentId();

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("week", parsed.week);
  if (count) {
    throw new Error(`La semana ${parsed.week} ya tiene partidos`);
  }

  // El jueves es siempre dos días después del martes. La suma se hace
  // sobre la fecha calendario, no sobre el instante: a las 8 PM de
  // Colombia el martes ya es miércoles en UTC y daría un día corrido.
  const [year, month, day] = parsed.tuesday.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day));
  anchor.setUTCDate(anchor.getUTCDate() + 2);
  const thursdayDate = anchor.toISOString().slice(0, 10);

  const tuesday = new Date(`${parsed.tuesday}T${parsed.tuesday_time}:00-05:00`);
  const thursday = new Date(
    `${thursdayDate}T${parsed.thursday_time}:00-05:00`,
  );

  const [tueStage, thuStage] = STAGES_BY_MODE[parsed.mode];
  const { error } = await supabase.from("matches").insert([
    {
      tournament_id: tournamentId,
      stage: tueStage,
      week: parsed.week,
      kickoff_at: tuesday.toISOString(),
      home_team_id: ids[0],
      away_team_id: ids[1],
    },
    {
      tournament_id: tournamentId,
      stage: thuStage,
      week: parsed.week,
      kickoff_at: thursday.toISOString(),
      home_team_id: ids[2],
      away_team_id: ids[3],
    },
  ]);
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
    url: "/torneo",
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
