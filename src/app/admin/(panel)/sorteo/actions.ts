"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAG_TORNEO } from "@/lib/data";
import { ordenAlAzar } from "@/lib/draft-turn";
import { getDraftData } from "@/lib/draft";
import { sendPushToAll } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
}

function revalidarSorteo() {
  revalidatePath("/admin/sorteo");
  revalidatePath("/sorteo");
  revalidatePath("/torneo");
  revalidatePath("/admin");
  // Elegir un jugador lo mete en un equipo, así que los datos del torneo
  // quedan viejos. `updateTag` y no `revalidateTag`: el admin tiene que
  // ver su propio cambio de inmediato.
  updateTag(TAG_TORNEO);
}

async function tournamentId(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", ACTIVE_TOURNAMENT_SLUG)
    .maybeSingle();
  if (!data) throw new Error("Torneo activo no encontrado");
  return (data as { id: string }).id;
}

/** Crea el sorteo del torneo activo con todos sus equipos dentro.
 *
 *  Entran todos por defecto y se van sacando: es más fácil quitar al que
 *  no juega que acordarse de meter a los cuatro que sí. */
export async function crearSorteo() {
  await requireAdmin();
  const supabase = createAdminClient();
  const tid = await tournamentId();

  const { data: creado, error } = await supabase
    .from("drafts")
    .insert({ tournament_id: tid })
    .select("id")
    .single();
  if (error) throw error;

  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("tournament_id", tid);
  const equipos = (teams as { id: string }[]) ?? [];
  if (equipos.length > 0) {
    const { error: e2 } = await supabase.from("draft_teams").insert(
      equipos.map((t) => ({
        draft_id: (creado as { id: string }).id,
        team_id: t.id,
      })),
    );
    if (e2) throw e2;
  }
  revalidarSorteo();
}

const configSchema = z.object({
  mode: z.enum(["pool", "pots"]),
  order_mode: z.enum(["once", "per_round"]),
});

export async function guardarConfiguracion(input: {
  mode: "pool" | "pots";
  order_mode: "once" | "per_round";
}) {
  await requireAdmin();
  const parsed = configSchema.parse(input);
  const supabase = createAdminClient();
  const tid = await tournamentId();

  const { error } = await supabase
    .from("drafts")
    .update(parsed)
    .eq("tournament_id", tid)
    .eq("status", "setup");
  if (error) throw error;
  revalidarSorteo();
}

/** Mete o saca a un equipo del sorteo. Solo antes de empezar: sacar a
 *  alguien a mitad de camino dejaría el orden con un hueco. */
export async function alternarParticipacion(teamId: string, participa: boolean) {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");
  if (data.draft.status !== "setup") {
    throw new Error("El sorteo ya arrancó: no se puede cambiar quién participa");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("draft_teams")
    .update({ participates: participa, position: null })
    .eq("draft_id", data.draft.id)
    .eq("team_id", teamId);
  if (error) throw error;
  revalidarSorteo();
}

/** Mueve a un jugador de bombo. `pot` nulo lo saca de los bombos. */
export async function asignarBombo(playerId: string, pot: number | null) {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");

  const supabase = createAdminClient();
  if (pot === null) {
    const { error } = await supabase
      .from("draft_pot_players")
      .delete()
      .eq("draft_id", data.draft.id)
      .eq("player_id", playerId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("draft_pot_players")
      .upsert(
        { draft_id: data.draft.id, player_id: playerId, pot },
        { onConflict: "draft_id,player_id" },
      );
    if (error) throw error;
  }
  revalidarSorteo();
}

/** Sortea el orden de elección. Devuelve el orden para que la animación
 *  del cliente revele un resultado que YA está guardado: si el azar
 *  viviera en el navegador, recargar sería volver a tirar los dados. */
export async function sortearOrden(): Promise<
  { teamId: string; position: number }[]
> {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");

  const participantes = data.equipos.filter((e) => e.participates);
  if (participantes.length < 2) {
    throw new Error("Hacen falta al menos dos equipos que participen");
  }

  const orden = ordenAlAzar(participantes.map((e) => e.teamId));
  const supabase = createAdminClient();
  for (const { item: teamId, position } of orden) {
    const { error } = await supabase
      .from("draft_teams")
      .update({ position })
      .eq("draft_id", data.draft.id)
      .eq("team_id", teamId);
    if (error) throw error;
  }
  // Los que no participan se quedan sin puesto, para que no cuenten.
  await supabase
    .from("draft_teams")
    .update({ position: null })
    .eq("draft_id", data.draft.id)
    .eq("participates", false);

  revalidarSorteo();
  return orden.map((o) => ({ teamId: o.item, position: o.position }));
}

export async function arrancarSorteo() {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");
  if (data.equipos.filter((e) => e.participates && e.position).length < 2) {
    throw new Error("Primero sortea el orden");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("drafts")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", data.draft.id);
  if (error) throw error;
  revalidarSorteo();
}

/** El equipo en turno elige a un jugador.
 *
 *  Primero se guarda la elección y después se mete al jugador en el
 *  equipo. Ese orden importa: `draft_picks` tiene único por jugador, así
 *  que si dos capitanes tocan el mismo nombre a la vez, el segundo
 *  rebota ahí y nadie termina en dos equipos. Si el paso siguiente falla,
 *  se deshace la elección en vez de dejarla sin reparto. */
export async function elegirJugador(playerId: string) {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");
  if (data.draft.status !== "running") throw new Error("El sorteo no está en curso");

  const equipo = data.equipoEnTurno;
  if (!equipo) throw new Error("No hay ningún equipo en turno");
  if (!data.disponiblesEnLaRonda.some((j) => j.id === playerId)) {
    throw new Error("Ese jugador no está disponible en esta ronda");
  }

  const supabase = createAdminClient();
  const pickNumber = data.picks.length + 1;

  const { data: pick, error } = await supabase
    .from("draft_picks")
    .insert({
      draft_id: data.draft.id,
      team_id: equipo.teamId,
      player_id: playerId,
      pot: data.potActual,
      round: data.draft.current_round,
      pick_number: pickNumber,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: e2 } = await supabase.from("team_players").insert({
    team_id: equipo.teamId,
    tournament_id: data.tournamentId,
    player_id: playerId,
  });
  if (e2) {
    // Compensación: sin esto quedaría una elección sin reparto y el
    // jugador seguiría apareciendo en el bombo.
    await supabase
      .from("draft_picks")
      .delete()
      .eq("id", (pick as { id: string }).id);
    throw e2;
  }

  revalidarSorteo();
}

/** Deshace la última elección: la quita del historial y saca al jugador
 *  del equipo. Es la red de seguridad de un sorteo en vivo, donde un
 *  toque mal dado no se puede "volver a jugar". */
export async function deshacerUltima() {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");
  const ultima = data.picks.at(-1);
  if (!ultima) throw new Error("Todavía no hay elecciones");

  const supabase = createAdminClient();
  await supabase
    .from("team_players")
    .delete()
    .eq("tournament_id", data.tournamentId)
    .eq("player_id", ultima.jugador.id);
  const { error } = await supabase
    .from("draft_picks")
    .delete()
    .eq("draft_id", data.draft.id)
    .eq("pick_number", ultima.pickNumber);
  if (error) throw error;
  revalidarSorteo();
}

/** Abre otra vuelta. NO mueve el bombo: ese avanza solo cuando el
 *  actual se queda sin gente, porque se deriva del bombo más bajo que
 *  todavía tenga jugadores. Si el orden es `per_round`, se vuelve a
 *  sortear. */
export async function siguienteRonda(): Promise<
  { teamId: string; position: number }[] | null
> {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("drafts")
    .update({ current_round: data.draft.current_round + 1 })
    .eq("id", data.draft.id);
  if (error) throw error;

  if (data.draft.mode === "pots" && data.draft.order_mode === "per_round") {
    return await sortearOrden();
  }
  revalidarSorteo();
  return null;
}

export async function cerrarSorteo() {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("drafts")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", data.draft.id);
  if (error) throw error;
  revalidarSorteo();
}

/** Deja el sorteo como antes de empezar y DEVUELVE al bombo a los que se
 *  repartieron en él.
 *
 *  Es para los ensayos: se prueba el recorrido completo y después se
 *  vuelve a la base sin tocar a nadie más. Lo que se saca de los equipos
 *  son exactamente los jugadores que están en `draft_picks` —no "los que
 *  sobran" ni "los últimos"—, así que la nómina con la que cada equipo
 *  llegó al sorteo queda intacta por construcción.
 *
 *  Los bombos se conservan: rearmarlos en cada ensayo sería el trabajo
 *  aburrido de la pantalla. El orden sí se borra, porque un sorteo nuevo
 *  empieza con un orden nuevo. */
export async function reiniciarSorteo(): Promise<number> {
  await requireAdmin();
  const data = await getDraftData();
  if (!data) throw new Error("No hay sorteo");

  const supabase = createAdminClient();
  const elegidos = data.picks.map((p) => p.jugador.id);

  if (elegidos.length > 0) {
    const { error } = await supabase
      .from("team_players")
      .delete()
      .eq("tournament_id", data.tournamentId)
      .in("player_id", elegidos);
    if (error) throw error;
  }

  const { error: e2 } = await supabase
    .from("draft_picks")
    .delete()
    .eq("draft_id", data.draft.id);
  if (e2) throw e2;

  await supabase
    .from("draft_teams")
    .update({ position: null })
    .eq("draft_id", data.draft.id);

  const { error: e3 } = await supabase
    .from("drafts")
    .update({
      status: "setup",
      current_round: 1,
      started_at: null,
      finished_at: null,
    })
    .eq("id", data.draft.id);
  if (e3) throw e3;

  revalidarSorteo();
  return elegidos.length;
}

/** Borra el sorteo entero. No toca `team_players`: los jugadores que ya
 *  se repartieron se quedan en su equipo, porque borrar el sorteo es
 *  rehacer el proceso, no deshacer lo acordado. Para deshacerlo está
 *  `reiniciarSorteo`. */
export async function borrarSorteo() {
  await requireAdmin();
  const supabase = createAdminClient();
  const tid = await tournamentId();
  const { error } = await supabase.from("drafts").delete().eq("tournament_id", tid);
  if (error) throw error;
  revalidarSorteo();
}

/** Avisa por push que arranca el sorteo. */
export async function avisarSorteo(mensaje: string): Promise<number> {
  await requireAdmin();
  const texto = mensaje.trim().slice(0, 160);
  if (!texto) throw new Error("El mensaje no puede ir vacío");

  const enviados = await sendPushToAll({
    title: "🎲 Arranca el sorteo",
    body: texto,
    url: "/sorteo",
    tag: "sorteo",
  });
  return enviados;
}
