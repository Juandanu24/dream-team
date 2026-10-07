import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG, type Match, type MatchStage } from "@/lib/types";

export type EstadoPendiente = "listo" | "borrador" | "falta" | "neutro";

export interface ItemPendiente {
  texto: string;
  estado: EstadoPendiente;
  href: string;
}

export interface FechaDeHoy {
  week: number;
  /** Los partidos de esa fecha, en orden. */
  partidos: {
    id: string;
    stage: MatchStage;
    kickoffAt: string | null;
    local: string;
    visita: string;
    jugado: boolean;
  }[];
  items: ItemPendiente[];
}

/** Qué te falta de la fecha más cercana.
 *
 *  El panel ya dice cuáles son los próximos partidos. Lo que no dice es
 *  qué está sin hacer, y eso se nota: en el torneo 1 quedaron un partido
 *  sin ninguna alineación, otra alineación en borrador, dos semanas sin
 *  anunciar por push, dos partidos sin figura y dos fechas sin once
 *  ideal. Cinco cosas distintas, ninguna por descuido de criterio: no
 *  había una sola pantalla que dijera qué faltaba.
 *
 *  La fecha elegida es la del partido más cercano a hoy en cualquier
 *  dirección, para que sirva antes del partido (falta la alineación) y
 *  después (falta el marcador). */
export async function getFechaDeHoy(): Promise<FechaDeHoy | null> {
  try {
    const supabase = createAdminClient();

    const { data: torneo } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!torneo) return null;
    const tournamentId = (torneo as { id: string }).id;

    const { data: matchRows } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId);
    const partidos = (matchRows as Match[]) ?? [];
    const conFecha = partidos.filter((m) => m.kickoff_at);
    if (conFecha.length === 0) return null;

    const ahora = Date.now();
    const cercano = conFecha.reduce((mejor, m) =>
      Math.abs(new Date(m.kickoff_at!).getTime() - ahora) <
      Math.abs(new Date(mejor.kickoff_at!).getTime() - ahora)
        ? m
        : mejor,
    );
    const week = cercano.week;
    const deLaFecha = partidos
      .filter((m) => m.week === week)
      .sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""));
    const ids = deLaFecha.map((m) => m.id);

    const [teams, lineups, eventos, onces] = await Promise.all([
      supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
      supabase
        .from("lineups")
        .select("match_id, team_id, published_at")
        .in("match_id", ids),
      supabase.from("match_events").select("match_id, type").in("match_id", ids),
      supabase
        .from("team_of_week")
        .select("week")
        .eq("tournament_id", tournamentId)
        .eq("week", week),
    ]);

    const nombreDe = (id: string | null) =>
      (teams.data as { id: string; name: string }[] | null)?.find(
        (t) => t.id === id,
      )?.name ?? "Por definir";

    const alineaciones =
      (lineups.data as
        | { match_id: string; team_id: string; published_at: string | null }[]
        | null) ?? [];
    const golesCargados =
      (eventos.data as { match_id: string; type: string }[] | null)?.filter(
        (e) => e.type === "goal" || e.type === "own_goal",
      ) ?? [];

    const items: ItemPendiente[] = [];

    // 1. ¿La fecha está anunciada por push?
    const anunciada = deLaFecha.every((m) => m.announced_at);
    items.push({
      texto: anunciada ? "Fecha anunciada por push" : "Fecha sin anunciar",
      estado: anunciada ? "listo" : "falta",
      href: "/admin/partidos",
    });

    // 2. Una alineación por equipo y por partido.
    for (const m of deLaFecha) {
      for (const teamId of [m.home_team_id, m.away_team_id]) {
        if (!teamId) continue;
        const suya = alineaciones.find(
          (l) => l.match_id === m.id && l.team_id === teamId,
        );
        items.push({
          texto: `Alineación ${nombreDe(teamId)}${
            suya && !suya.published_at ? ": en borrador" : ""
          }`,
          estado: !suya ? "falta" : suya.published_at ? "listo" : "borrador",
          href: "/admin/alineaciones",
        });
      }
    }

    // 3. Marcador y figura, por partido ya jugado o por jugar.
    for (const m of deLaFecha) {
      items.push({
        texto: `Marcador ${nombreDe(m.home_team_id)} vs ${nombreDe(m.away_team_id)}`,
        estado: m.status === "finished" ? "listo" : "neutro",
        href: "/admin/resultados",
      });
      if (m.status === "finished") {
        items.push({
          texto: `Figura de ${nombreDe(m.home_team_id)} vs ${nombreDe(m.away_team_id)}`,
          estado: m.mvp_player_id ? "listo" : "falta",
          href: "/admin/resultados",
        });
        // Solo se avisa si hay ALGUNOS goles cargados: cero autores en un
        // 10-6 es una decisión válida, no una carga a medias. Misma regla
        // que el aviso de /admin/resultados.
        const mios = golesCargados.filter((e) => e.match_id === m.id).length;
        const marcador = (m.home_score ?? 0) + (m.away_score ?? 0);
        if (mios > 0 && mios < marcador) {
          items.push({
            texto: `Faltan ${marcador - mios} goles por asignar`,
            estado: "falta",
            href: "/admin/resultados",
          });
        }
      }
    }

    // 4. El once ideal de la fecha.
    const hayOnce = ((onces.data as unknown[]) ?? []).length > 0;
    items.push({
      texto: hayOnce ? "Once ideal armado" : "Once ideal de la fecha",
      estado: hayOnce ? "listo" : deLaFecha.every((m) => m.status === "finished") ? "falta" : "neutro",
      href: "/admin/once-ideal",
    });

    return {
      week,
      partidos: deLaFecha.map((m) => ({
        id: m.id,
        stage: m.stage,
        kickoffAt: m.kickoff_at,
        local: nombreDe(m.home_team_id),
        visita: nombreDe(m.away_team_id),
        jugado: m.status === "finished",
      })),
      items,
    };
  } catch (error) {
    console.error("Error cargando los pendientes de la fecha:", error);
    return null;
  }
}

export interface PanelDeInscripcion {
  /** Cuántos del torneo anterior ya se reinscribieron. */
  vuelven: number;
  /** Cuántos jugaron el torneo anterior. */
  delAnterior: number;
  nombreAnterior: string;
  pagos: { verificados: number; porRevisar: number; sinComprobante: number };
  suscritosPush: number;
  /** Aprobados que todavía no tienen equipo. */
  sinEquipo: string[];
}

/** El tablero de la temporada de inscripciones.
 *
 *  Los 82 jugadores son globales pero `registrations` es por torneo, así
 *  que los del torneo pasado tienen que volver a inscribirse uno por uno
 *  — y hoy no hay forma de saber quién ya lo hizo. Las columnas de pago
 *  de la migración 00015 tampoco tienen agregado: se ven fila por fila. */
export async function getPanelDeInscripcion(): Promise<PanelDeInscripcion | null> {
  try {
    const supabase = createAdminClient();

    const { data: torneos } = await supabase
      .from("tournaments")
      .select("id, slug, name, status, created_at")
      .order("created_at", { ascending: false });
    const lista =
      (torneos as {
        id: string;
        slug: string;
        name: string;
        status: string;
        created_at: string;
      }[]) ?? [];

    const actual = lista.find((t) => t.slug === ACTIVE_TOURNAMENT_SLUG);
    if (!actual) return null;
    const anterior = lista.find(
      (t) => t.status === "finished" && t.created_at < actual.created_at,
    );

    const [mias, previas, equipos, push] = await Promise.all([
      supabase
        .from("registrations")
        .select("player_id, status, payment_proof_path, payment_verified_at")
        .eq("tournament_id", actual.id),
      anterior
        ? supabase
            .from("registrations")
            .select("player_id")
            .eq("tournament_id", anterior.id)
            .eq("status", "approved")
        : Promise.resolve({ data: [] as { player_id: string }[] }),
      supabase
        .from("team_players")
        .select("player_id")
        .eq("tournament_id", actual.id),
      supabase.from("push_subscriptions").select("id"),
    ]);

    const inscritos =
      (mias.data as {
        player_id: string;
        status: string;
        payment_proof_path: string | null;
        payment_verified_at: string | null;
      }[]) ?? [];
    const delAnterior =
      ((previas.data as { player_id: string }[]) ?? []).map((r) => r.player_id);
    const yaInscritos = new Set(inscritos.map((r) => r.player_id));

    const conEquipo = new Set(
      ((equipos.data as { player_id: string }[]) ?? []).map((r) => r.player_id),
    );
    const aprobadosSinEquipo = inscritos
      .filter((r) => r.status === "approved" && !conEquipo.has(r.player_id))
      .map((r) => r.player_id);

    let nombresSinEquipo: string[] = [];
    if (aprobadosSinEquipo.length > 0) {
      const { data } = await supabase
        .from("players")
        .select("full_name")
        .in("id", aprobadosSinEquipo);
      nombresSinEquipo = ((data as { full_name: string }[]) ?? []).map(
        (p) => p.full_name,
      );
    }

    return {
      vuelven: delAnterior.filter((id) => yaInscritos.has(id)).length,
      delAnterior: delAnterior.length,
      nombreAnterior: anterior?.name ?? "",
      pagos: {
        verificados: inscritos.filter((r) => r.payment_verified_at).length,
        porRevisar: inscritos.filter(
          (r) => r.payment_proof_path && !r.payment_verified_at,
        ).length,
        sinComprobante: inscritos.filter((r) => !r.payment_proof_path).length,
      },
      suscritosPush: ((push.data as unknown[]) ?? []).length,
      sinEquipo: nombresSinEquipo,
    };
  } catch (error) {
    console.error("Error cargando el panel de inscripción:", error);
    return null;
  }
}
