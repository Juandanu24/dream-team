import type { Metadata } from "next";
import { TournamentView } from "./tournament-view";

// Dinámica a propósito, aunque los datos estén cacheados. Prerenderizar
// guardaría el estado vacío que sale cuando el build corre sin
// credenciales de Supabase, y el primer visitante vería eso.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "El torneo",
  description:
    "Tabla de posiciones, calendario, equipos y goleadores del torneo del Dream Team.",
};

export default async function TournamentPage() {
  // Sin slug: el torneo en curso, el que fija ACTIVE_TOURNAMENT_SLUG.
  return <TournamentView />;
}
