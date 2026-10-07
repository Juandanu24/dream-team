import "server-only";

import { unstable_cache } from "next/cache";
import { TAG_TORNEO } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  TORNEO_DE_PRUEBA,
  type TournamentStatus,
} from "@/lib/types";

export interface TournamentListItem {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  createdAt: string;
  /** El que marca NEXT_PUBLIC_TOURNAMENT_SLUG: sobre el que escribe el admin. */
  activo: boolean;
  /** El de pruebas: se marca distinto para no confundirlo con uno real. */
  esPrueba: boolean;
  equipos: number;
  inscritos: { aprobados: number; pendientes: number; rechazados: number };
  partidos: { jugados: number; total: number };
  goles: number;
}

type FilaTorneo = {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  created_at: string;
};

async function cargarTorneos(): Promise<TournamentListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, slug, name, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const lista = (data as FilaTorneo[]) ?? [];
  if (lista.length === 0) return [];
  const ids = lista.map((t) => t.id);

  // Tres consultas con `.in()` y la cuenta en memoria, como en
  // `cargarPalmares()`. Llamar a `getTournamentData()` por torneo serían
  // nueve consultas cada uno.
  const [teams, registrations, matches] = await Promise.all([
    supabase.from("teams").select("tournament_id").in("tournament_id", ids),
    supabase
      .from("registrations")
      .select("tournament_id, status")
      .in("tournament_id", ids),
    supabase
      .from("matches")
      .select("tournament_id, status, home_score, away_score")
      .in("tournament_id", ids),
  ]);
  if (teams.error) throw teams.error;
  if (registrations.error) throw registrations.error;
  if (matches.error) throw matches.error;

  const equipos = (teams.data as { tournament_id: string }[]) ?? [];
  const inscripciones =
    (registrations.data as { tournament_id: string; status: string }[]) ?? [];
  const partidos =
    (matches.data as {
      tournament_id: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
    }[]) ?? [];

  return lista.map((t) => {
    const mios = partidos.filter((m) => m.tournament_id === t.id);
    const insc = inscripciones.filter((r) => r.tournament_id === t.id);
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      createdAt: t.created_at,
      activo: t.slug === ACTIVE_TOURNAMENT_SLUG,
      esPrueba: t.slug === TORNEO_DE_PRUEBA,
      equipos: equipos.filter((e) => e.tournament_id === t.id).length,
      inscritos: {
        aprobados: insc.filter((r) => r.status === "approved").length,
        pendientes: insc.filter((r) => r.status === "pending").length,
        rechazados: insc.filter((r) => r.status === "rejected").length,
      },
      partidos: {
        jugados: mios.filter((m) => m.status === "finished").length,
        total: mios.length,
      },
      goles: mios.reduce(
        (n, m) => n + (m.home_score ?? 0) + (m.away_score ?? 0),
        0,
      ),
    };
  });
}

const torneosCacheados = unstable_cache(cargarTorneos, ["lista-torneos"], {
  tags: [TAG_TORNEO],
  revalidate: 3600,
});

/** Todos los torneos, el de pruebas incluido. Para el admin.
 *
 *  El `try/catch` va AFUERA del caché: adentro, una lista vacía por un
 *  fallo de red se guardaría como si fuera la respuesta buena y se
 *  serviría una hora. Es la regla que ya costó que desapareciera el
 *  cartel del hero en producción. */
export async function getTournamentList(): Promise<TournamentListItem[]> {
  try {
    return await torneosCacheados();
  } catch (error) {
    console.error("Error cargando los torneos:", error);
    return [];
  }
}

/** Los que puede ver cualquiera. Sin el de pruebas: tiene 24 inscritos y
 *  4 equipos inventados, y en una lista pública pasaría por real. */
export async function getPublicTournamentList(): Promise<TournamentListItem[]> {
  const todos = await getTournamentList();
  return todos.filter((t) => t.slug !== TORNEO_DE_PRUEBA);
}
