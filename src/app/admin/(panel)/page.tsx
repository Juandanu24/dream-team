import Link from "next/link";
import { CalendarDays, ClipboardList, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Summary {
  pending: number;
  approved: number;
  teams: number;
  matches: number;
}

async function getSummary(): Promise<Summary | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const count = (table: string, filters: Record<string, string>) => {
      let query = supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournament.id);
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      return query;
    };

    const [pending, approved, teams, matches] = await Promise.all([
      count("registrations", { status: "pending" }),
      count("registrations", { status: "approved" }),
      count("teams", {}),
      count("matches", {}),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      teams: teams.count ?? 0,
      matches: matches.count ?? 0,
    };
  } catch (error) {
    console.error("Error cargando resumen admin:", error);
    return null;
  }
}

export default async function AdminHomePage() {
  const summary = await getSummary();

  const tiles = [
    {
      href: "/admin/inscripciones",
      icon: ClipboardList,
      label: "Pendientes por aprobar",
      value: summary?.pending,
      highlight: (summary?.pending ?? 0) > 0,
    },
    {
      href: "/admin/inscripciones",
      icon: Users,
      label: "Jugadores aprobados",
      value: summary?.approved,
    },
    {
      href: "/admin/equipos",
      icon: Users,
      label: "Equipos creados",
      value: summary?.teams,
    },
    {
      href: "/admin/partidos",
      icon: CalendarDays,
      label: "Partidos programados",
      value: summary?.matches,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide">
        PANEL DEL <span className="text-volt">TORNEO</span>
      </h1>
      {summary === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. ¿Ya configuraste Supabase y el
          archivo .env.local? Mira el AGENTS.md del proyecto.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card
                className={`h-full border-border/60 bg-card/70 transition-colors hover:border-volt/50 ${
                  tile.highlight ? "border-volt/60" : ""
                }`}
              >
                <CardContent className="px-5 py-2">
                  <tile.icon className="size-5 text-volt" aria-hidden />
                  <p className="mt-3 font-display text-4xl">{tile.value}</p>
                  <p className="text-sm text-muted-foreground">{tile.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
