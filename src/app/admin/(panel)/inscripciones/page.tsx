import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_TOURNAMENT_SLUG,
  FOOT_LABELS,
  POSITION_LABELS,
  REGISTRATION_LABELS,
  type Player,
  type Registration,
} from "@/lib/types";
import {
  approveRegistration,
  deleteRegistration,
  rejectRegistration,
  resetRegistration,
} from "./actions";
import { PlayerEditDialog } from "./player-edit-dialog";

export const dynamic = "force-dynamic";

interface RegistrationWithPlayer extends Registration {
  players: Player;
}

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

const statusVariant = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
} as const;

export default async function AdminRegistrationsPage() {
  const registrations = await getRegistrations();
  const pendingCount =
    registrations?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">
          INSCRIPCIONES
        </h1>
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
        <div className="mt-6 space-y-2">
          {registrations.map((registration) => {
            const player = registration.players;
            return (
              <Card
                key={registration.id}
                className="border-border/60 bg-card/70 py-3"
              >
                <CardContent className="flex flex-wrap items-center gap-3 px-4">
                  <Avatar className="size-11">
                    <AvatarImage src={player.photo_url ?? undefined} alt="" />
                    <AvatarFallback>
                      {player.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{player.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {player.email} · {player.age} años ·{" "}
                      {POSITION_LABELS[player.position]} ·{" "}
                      {FOOT_LABELS[player.dominant_foot]} · En el DT:{" "}
                      {player.member_since}
                    </p>
                  </div>
                  <Badge variant={statusVariant[registration.status]}>
                    {REGISTRATION_LABELS[registration.status]}
                  </Badge>
                  <div className="flex gap-1">
                    {registration.status === "pending" ? (
                      <>
                        <form action={approveRegistration.bind(null, registration.id)}>
                          <Button size="sm" type="submit" title="Aprobar">
                            <Check aria-hidden />
                          </Button>
                        </form>
                        <form action={rejectRegistration.bind(null, registration.id)}>
                          <Button
                            size="sm"
                            variant="destructive"
                            type="submit"
                            title="Rechazar"
                          >
                            <X aria-hidden />
                          </Button>
                        </form>
                      </>
                    ) : (
                      <form action={resetRegistration.bind(null, registration.id)}>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="submit"
                          title="Volver a pendiente"
                        >
                          <RotateCcw aria-hidden />
                        </Button>
                      </form>
                    )}
                    <PlayerEditDialog player={player} />
                    <ConfirmButton
                      action={deleteRegistration.bind(null, registration.id)}
                      message={`¿Eliminar la solicitud de ${player.full_name}? Si estaba en un equipo, sale de la plantilla.`}
                      variant="ghost"
                      title="Eliminar solicitud"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </ConfirmButton>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
