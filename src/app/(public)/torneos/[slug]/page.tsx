import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TournamentView } from "../../torneo/tournament-view";

// Dinámica a propósito, aunque los datos estén cacheados. Prerenderizar
// guardaría el estado vacío que sale cuando el build corre sin
// credenciales de Supabase, y el primer visitante vería eso.
export const dynamic = "force-dynamic";

// Next 16: los params llegan como promesa.
type Params = { params: Promise<{ slug: string }> };

async function tournamentName(slug: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("tournaments")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const name = await tournamentName(slug);
  return {
    title: name ?? "Torneo",
    description: name
      ? `Tabla, calendario, equipos y goleadores del ${name}.`
      : "Archivo de torneos del Dream Team.",
  };
}

export default async function ArchivedTournamentPage({ params }: Params) {
  const { slug } = await params;
  // Un slug inventado no debe devolver la pantalla vacía de "aún no está
  // configurado": eso confunde. Es un 404.
  if (!(await tournamentName(slug))) notFound();

  return <TournamentView slug={slug} archivado />;
}
