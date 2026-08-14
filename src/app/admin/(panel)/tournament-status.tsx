import { CheckCircle2, DoorClosed, DoorOpen, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TournamentStatus } from "@/lib/types";
import { updateTournamentStatus } from "./tournament-actions";

const OPTIONS: {
  value: TournamentStatus;
  label: string;
  detail: string;
  icon: typeof DoorOpen;
}[] = [
  {
    value: "registration",
    label: "Inscripciones abiertas",
    detail: "Cualquiera con el link puede inscribirse.",
    icon: DoorOpen,
  },
  {
    value: "in_progress",
    label: "Torneo en juego",
    detail: "Se cierran las inscripciones. Nadie más se puede sumar.",
    icon: Flag,
  },
  {
    value: "finished",
    label: "Torneo finalizado",
    detail: "Queda como histórico; tampoco admite inscripciones.",
    icon: DoorClosed,
  },
];

export function TournamentStatusCard({ status }: { status: TournamentStatus }) {
  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader>
        <CardTitle className="font-display text-2xl tracking-wide">
          ESTADO DEL TORNEO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {OPTIONS.map((option) => {
          const active = option.value === status;
          return (
            <form
              key={option.value}
              action={updateTournamentStatus}
              className="flex items-center gap-3"
            >
              <input type="hidden" name="status" value={option.value} />
              <option.icon
                className={active ? "size-5 text-volt" : "size-5 text-muted-foreground"}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {option.label}
                  {active ? (
                    <CheckCircle2
                      className="ml-1.5 inline size-4 text-volt"
                      aria-label="Estado actual"
                    />
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{option.detail}</p>
              </div>
              {active ? null : (
                <Button variant="outline" size="sm" type="submit">
                  Activar
                </Button>
              )}
            </form>
          );
        })}

        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Los avisos push se envían a todos los suscritos al publicar el
          fixture y al marcar un partido como jugado.
        </p>
      </CardContent>
    </Card>
  );
}
