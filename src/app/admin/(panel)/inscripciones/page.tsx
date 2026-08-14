import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_TOURNAMENT_SLUG } from "@/lib/types";
import {
  RegistrationsList,
  type RegistrationWithPlayer,
} from "./registrations-list";

export const dynamic = "force-dynamic";

async function getRegistrations(): Promise<RegistrationWithPlayer[] | null> {
  try {
    const supabase = createAdminClient();
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id")
      .eq("slug", ACTIVE_TOURNAMENT_SLUG)
      .maybeSingle();
    if (!tournament) return null;

    const { data } = await supabase
      .from("registrations")
      .select("*, players(*)")
      .eq("tournament_id", tournament.id)
      .order("created_at");

    const rows = (data as unknown as RegistrationWithPlayer[]) ?? [];
    const order = { pending: 0, approved: 1, rejected: 2 } as const;
    return rows.sort((a, b) => order[a.status] - order[b.status]);
  } catch (error) {
    console.error("Error cargando inscripciones:", error);
    return null;
  }
}

export default async function AdminRegistrationsPage() {
  const registrations = await getRegistrations();
  const pendingCount =
    registrations?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">INSCRIPCIONES</h1>
        {pendingCount > 0 ? (
          <Badge className="bg-primary text-primary-foreground">
            {pendingCount} por revisar
          </Badge>
        ) : null}
      </div>

      {registrations === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo leer la base de datos. Revisa la configuración de Supabase.
        </p>
      ) : registrations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay inscritos. Comparte el link de{" "}
          <span className="text-volt">/inscripcion</span> en el grupo.
        </p>
      ) : (
        <div className="mt-6">
          <RegistrationsList registrations={registrations} />
        </div>
      )}
    </div>
  );
}
