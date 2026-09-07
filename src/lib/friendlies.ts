import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Friendly,
  FriendlyPlayer,
  FriendlySide,
  LineupLine,
} from "@/lib/types";

/** Un jugador de un amistoso, ya resuelto a nombre y foto: si viene de
 *  `players` sale de ahí, y si es invitado sale de `guest_name`. Quien
 *  dibuje la cancha no tiene que saber cuál de los dos era. */
export interface FriendlyPlayerRow extends FriendlyPlayer {
  full_name: string;
  photo_url: string | null;
}

export interface FriendlySideWithPlayers extends FriendlySide {
  entries: FriendlyPlayerRow[];
}

export interface FriendlyWithSides extends Friendly {
  sides: FriendlySideWithPlayers[];
}

/** Alguien de la base a quien se puede convocar. */
export interface Convocable {
  id: string;
  full_name: string;
  photo_url: string | null;
}

export interface FriendliesData {
  friendlies: FriendlyWithSides[];
  /** TODA la gente de `players`, no el plantel del torneo: estos
   *  partidos son justamente con quien no está en él. */
  convocables: Convocable[];
}

export type FriendliesResult =
  | { ok: true; data: FriendliesData }
  | { ok: false; reason: "sin-migrar" | "sin-conexion" };

type RawEntry = FriendlyPlayer & {
  players: { full_name: string; photo_url: string | null } | null;
};

/** Todo lo que necesita el módulo de amistosos del admin. */
export async function getFriendliesData(): Promise<FriendliesResult> {
  try {
    const supabase = createAdminClient();

    const [friendlies, sides, entries, people] = await Promise.all([
      supabase
        .from("friendlies")
        .select("*")
        .order("kickoff_at", { ascending: false, nullsFirst: false }),
      supabase.from("friendly_sides").select("*").order("slot"),
      supabase
        .from("friendly_players")
        .select("*, players(full_name, photo_url)"),
      supabase
        .from("players")
        .select("id, full_name, photo_url")
        .order("full_name"),
    ]);

    // Sin la migración 00013 las tablas no existen. PostgREST responde
    // PGRST205 ("no está en el schema cache"), no el 42P01 de Postgres:
    // se comprobó contra el proyecto real. Se distingue de un fallo de
    // conexión para poder decirle al admin exactamente qué le falta.
    const SIN_TABLA = ["PGRST205", "42P01"];
    const falta = [friendlies, sides, entries].some((r) =>
      SIN_TABLA.includes(r.error?.code ?? ""),
    );
    if (falta) return { ok: false, reason: "sin-migrar" };

    const porLado = new Map<string, FriendlyPlayerRow[]>();
    for (const raw of ((entries.data as unknown as RawEntry[]) ?? [])) {
      const fila: FriendlyPlayerRow = {
        ...raw,
        line: raw.line as LineupLine,
        full_name: raw.players?.full_name ?? raw.guest_name ?? "Invitado",
        photo_url: raw.players?.photo_url ?? null,
      };
      const lista = porLado.get(raw.side_id) ?? [];
      lista.push(fila);
      porLado.set(raw.side_id, lista);
    }

    const porAmistoso = new Map<string, FriendlySideWithPlayers[]>();
    for (const side of ((sides.data as FriendlySide[]) ?? [])) {
      const lista = porAmistoso.get(side.friendly_id) ?? [];
      lista.push({ ...side, entries: porLado.get(side.id) ?? [] });
      porAmistoso.set(side.friendly_id, lista);
    }

    return {
      ok: true,
      data: {
        friendlies: ((friendlies.data as Friendly[]) ?? []).map((f) => ({
          ...f,
          sides: (porAmistoso.get(f.id) ?? []).sort((a, b) => a.slot - b.slot),
        })),
        convocables: (people.data as Convocable[]) ?? [],
      },
    };
  } catch (error) {
    console.error("Error cargando amistosos:", error);
    return { ok: false, reason: "sin-conexion" };
  }
}
