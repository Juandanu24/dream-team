import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { estadoDelTurno, type EstadoDelTurno } from "@/lib/draft-turn";
import {
  ACTIVE_TOURNAMENT_SLUG,
  cardName,
  type Draft,
  type DraftPick,
  type DraftPotPlayer,
  type DraftTeam,
  type Player,
  type Team,
} from "@/lib/types";

export interface JugadorDelSorteo {
  id: string;
  nombre: string;
  nombreCompleto: string;
  photoUrl: string | null;
  position: Player["position"];
  memberSince: string;
  /** En qué bombo quedó. Null en modo bolsa o si todavía no se asignó. */
  pot: number | null;
}

export interface EquipoDelSorteo {
  teamId: string;
  name: string;
  color: string | null;
  crestUrl: string | null;
  participates: boolean;
  position: number | null;
  /** Quién elige por el equipo. Null si no se marcó capitán. */
  capitan: string | null;
  /** Cuántos tiene hoy, contando los que ya eligió. */
  jugadores: number;
  /** Los que eligió en este sorteo, en orden. */
  elegidos: JugadorDelSorteo[];
}

export interface PickDelSorteo {
  pickNumber: number;
  round: number;
  pot: number | null;
  teamId: string;
  teamName: string;
  teamColor: string | null;
  jugador: JugadorDelSorteo;
  createdAt: string;
}

export interface DraftData {
  draft: Draft;
  tournamentId: string;
  equipos: EquipoDelSorteo[];
  /** Aprobados sin equipo: el bombo completo, sin repartir todavía. */
  disponibles: JugadorDelSorteo[];
  /** Los que puede elegir el equipo en turno AHORA mismo. */
  disponiblesEnLaRonda: JugadorDelSorteo[];
  picks: PickDelSorteo[];
  turno: EstadoDelTurno;
  /** El equipo al que le toca, resuelto. */
  equipoEnTurno: EquipoDelSorteo | null;
}

function aJugador(p: Player, pot: number | null): JugadorDelSorteo {
  return {
    id: p.id,
    nombre: cardName(p),
    nombreCompleto: p.full_name,
    photoUrl: p.photo_url,
    position: p.position,
    memberSince: p.member_since,
    pot,
  };
}

/** Todo lo del sorteo del torneo activo, en un viaje.
 *
 *  SIN caché a propósito, al revés que el resto de loaders: esto cambia
 *  cada pocos segundos mientras el sorteo corre y servir una versión de
 *  hace un minuto sería mostrar un turno que ya pasó.
 *
 *  El bombo no se guarda en una tabla: son los aprobados que no tienen
 *  equipo. Así elegir a alguien lo saca del bombo solo, sin un segundo
 *  sitio que mantener sincronizado. */
export async function getDraftData(
  slug: string = ACTIVE_TOURNAMENT_SLUG,
): Promise<DraftData | null> {
  try {
    const supabase = createAdminClient();

    const { data: torneo } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!torneo) return null;
    const tournamentId = (torneo as { id: string }).id;

    const { data: draftRow, error } = await supabase
      .from("drafts")
      .select("*")
      .eq("tournament_id", tournamentId)
      .maybeSingle();
    // Sin la migración 00019 la tabla no existe; la pantalla lo dice en
    // vez de reventar. PostgREST responde PGRST205, no el 42P01 de
    // Postgres.
    if (error && ["PGRST205", "42P01"].includes(error.code)) return null;
    if (!draftRow) return null;
    const draft = draftRow as Draft;

    const [teamsRes, draftTeamsRes, rosterRes, regsRes, potsRes, picksRes] =
      await Promise.all([
        supabase.from("teams").select("*").eq("tournament_id", tournamentId),
        supabase.from("draft_teams").select("*").eq("draft_id", draft.id),
        supabase
          .from("team_players")
          .select("player_id, team_id, is_captain")
          .eq("tournament_id", tournamentId),
        supabase
          .from("registrations")
          .select("player_id")
          .eq("tournament_id", tournamentId)
          .eq("status", "approved"),
        supabase.from("draft_pot_players").select("*").eq("draft_id", draft.id),
        supabase
          .from("draft_picks")
          .select("*")
          .eq("draft_id", draft.id)
          .order("pick_number"),
      ]);

    const teams = (teamsRes.data as Team[]) ?? [];
    const draftTeams = (draftTeamsRes.data as DraftTeam[]) ?? [];
    const roster =
      (rosterRes.data as {
        player_id: string;
        team_id: string;
        is_captain: boolean | null;
      }[]) ?? [];
    const aprobados = ((regsRes.data as { player_id: string }[]) ?? []).map(
      (r) => r.player_id,
    );
    const pots = (potsRes.data as DraftPotPlayer[]) ?? [];
    const picks = (picksRes.data as DraftPick[]) ?? [];

    // Una sola consulta por los jugadores que hacen falta: los del bombo
    // y los que ya fueron elegidos.
    const conEquipo = new Set(roster.map((r) => r.player_id));
    const sinEquipo = aprobados.filter((id) => !conEquipo.has(id));
    const capitanes = roster.filter((r) => r.is_captain).map((r) => r.player_id);
    const necesarios = [
      ...new Set([...sinEquipo, ...picks.map((p) => p.player_id), ...capitanes]),
    ];
    const { data: playerRows } = necesarios.length
      ? await supabase.from("players").select("*").in("id", necesarios)
      : { data: [] as Player[] };
    const jugadores = new Map(
      ((playerRows as Player[]) ?? []).map((p) => [p.id, p]),
    );
    const potDe = new Map(pots.map((p) => [p.player_id, p.pot]));

    const equipoPorId = new Map(teams.map((t) => [t.id, t]));
    const picksDetalle: PickDelSorteo[] = picks.flatMap((pk) => {
      const jugador = jugadores.get(pk.player_id);
      const equipo = equipoPorId.get(pk.team_id);
      if (!jugador) return [];
      return [
        {
          pickNumber: pk.pick_number,
          round: pk.round,
          pot: pk.pot,
          teamId: pk.team_id,
          teamName: equipo?.name ?? "—",
          teamColor: equipo?.color ?? null,
          jugador: aJugador(jugador, pk.pot),
          createdAt: pk.created_at,
        },
      ];
    });

    const equipos: EquipoDelSorteo[] = draftTeams
      .flatMap((dt) => {
        const t = equipoPorId.get(dt.team_id);
        if (!t) return [];
        return [
          {
            teamId: dt.team_id,
            name: t.name,
            color: t.color,
            crestUrl: t.crest_url ?? null,
            participates: dt.participates,
            position: dt.position,
            capitan: (() => {
              const c = roster.find(
                (r) => r.team_id === dt.team_id && r.is_captain,
              );
              const p = c ? jugadores.get(c.player_id) : undefined;
              return p ? cardName(p) : null;
            })(),
            jugadores: roster.filter((r) => r.team_id === dt.team_id).length,
            elegidos: picksDetalle
              .filter((p) => p.teamId === dt.team_id)
              .map((p) => p.jugador),
          },
        ];
      })
      .sort(
        (a, b) =>
          (a.position ?? 99) - (b.position ?? 99) || a.name.localeCompare(b.name),
      );

    const disponibles = sinEquipo
      .flatMap((id) => {
        const p = jugadores.get(id);
        return p ? [aJugador(p, potDe.get(id) ?? null)] : [];
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // En modo bombos solo se puede elegir del bombo de la ronda.
    const disponiblesEnLaRonda =
      draft.mode === "pots"
        ? disponibles.filter((j) => j.pot === draft.current_round)
        : disponibles;

    const participantes = equipos
      .filter((e) => e.participates && e.position !== null)
      .map((e) => ({ teamId: e.teamId, position: e.position! }));

    const turno = estadoDelTurno(
      participantes,
      picks.map((p) => ({ teamId: p.team_id, round: p.round })),
      draft.current_round,
      disponiblesEnLaRonda.length,
    );

    return {
      draft,
      tournamentId,
      equipos,
      disponibles,
      disponiblesEnLaRonda,
      picks: picksDetalle,
      turno,
      equipoEnTurno:
        equipos.find((e) => e.teamId === turno.teamId) ?? null,
    };
  } catch (error) {
    console.error("Error cargando el sorteo:", error);
    return null;
  }
}
