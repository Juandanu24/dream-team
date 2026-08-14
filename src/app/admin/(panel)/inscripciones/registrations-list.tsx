"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import {
  FOOT_LABELS,
  POSITION_LABELS,
  REGISTRATION_LABELS,
  type Player,
  type Registration,
  type RegistrationStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  approveRegistration,
  deleteRegistration,
  rejectRegistration,
  resetRegistration,
} from "./actions";
import { PlayerEditDialog } from "./player-edit-dialog";

export interface RegistrationWithPlayer extends Registration {
  players: Player;
}

const statusVariant = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
} as const;

const FILTERS: { value: RegistrationStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

export function RegistrationsList({
  registrations,
}: {
  registrations: RegistrationWithPlayer[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RegistrationStatus | "all">("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((registration) => {
      if (status !== "all" && registration.status !== status) return false;
      if (!q) return true;
      const player = registration.players;
      return (
        player.full_name.toLowerCase().includes(q) ||
        player.email.toLowerCase().includes(q)
      );
    });
  }, [registrations, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="pl-9"
            aria-label="Buscar inscritos"
          />
        </div>
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={status === filter.value ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "shrink-0",
                status === filter.value && "text-foreground",
              )}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} de {registrations.length} inscritos
      </p>

      <div className="space-y-2">
        {visible.map((registration) => {
          const player = registration.players;
          return (
            <Card key={registration.id} className="border-border/60 bg-card/70 py-3">
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

        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ningún inscrito coincide con la búsqueda.
          </p>
        ) : null}
      </div>
    </div>
  );
}
