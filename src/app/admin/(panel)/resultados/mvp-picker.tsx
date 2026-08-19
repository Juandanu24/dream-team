"use client";

import { useTransition } from "react";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { setMatchMvp } from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

export interface MvpOption {
  playerId: string;
  name: string;
  teamName: string;
}

/** Selector de la figura del partido, entre los de los dos equipos. */
export function MvpPicker({
  matchId,
  current,
  options,
}: {
  matchId: string;
  current: string | null;
  options: MvpOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={`mvp-${matchId}`}
        className="flex items-center gap-1.5 text-xs"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trophy className="size-3.5 text-volt" aria-hidden />
        )}
        Figura del partido
      </Label>
      <select
        id={`mvp-${matchId}`}
        className={selectClass}
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => {
          const valor = e.target.value || null;
          startTransition(async () => {
            try {
              await setMatchMvp(matchId, valor);
              toast.success(valor ? "Figura elegida" : "Figura quitada");
            } catch {
              toast.error(
                "No se pudo guardar. ¿Corriste la migración 00011?",
              );
            }
          });
        }}
      >
        <option value="">— Sin figura —</option>
        {options.map((o) => (
          <option key={o.playerId} value={o.playerId}>
            {o.name} ({o.teamName})
          </option>
        ))}
      </select>
    </div>
  );
}
