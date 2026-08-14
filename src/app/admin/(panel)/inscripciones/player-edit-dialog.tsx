"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberSinceField } from "@/components/member-since-field";
import { FOOT_LABELS, POSITION_LABELS, type Player } from "@/lib/types";
import { updatePlayer } from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

// Edición de los datos de la carta de un jugador.
export function PlayerEditDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Editar carta">
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            EDITAR CARTA
          </DialogTitle>
        </DialogHeader>
        <form
          action={async (formData: FormData) => {
            try {
              await updatePlayer(player.id, formData);
              setOpen(false);
              toast.success("Carta actualizada");
            } catch {
              toast.error("No se pudo guardar, revisa los datos");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`pl-name-${player.id}`}>Nombre</Label>
            <Input
              id={`pl-name-${player.id}`}
              name="full_name"
              defaultValue={player.full_name}
              maxLength={80}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`pl-age-${player.id}`}>Edad</Label>
              <Input
                id={`pl-age-${player.id}`}
                name="age"
                type="number"
                min={10}
                max={80}
                defaultValue={player.age}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ms-${player.id}-kind`}>Tiempo en el DT</Label>
              <MemberSinceField
                defaultValue={player.member_since}
                idPrefix={`ms-${player.id}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pl-foot-${player.id}`}>Pie dominante</Label>
              <select
                id={`pl-foot-${player.id}`}
                name="dominant_foot"
                defaultValue={player.dominant_foot}
                className={selectClass}
              >
                {Object.entries(FOOT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pl-pos-${player.id}`}>Posición</Label>
              <select
                id={`pl-pos-${player.id}`}
                name="position"
                defaultValue={player.position}
                className={selectClass}
              >
                {Object.entries(POSITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La foto se cambia volviéndose a inscribir con el mismo email.
          </p>
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
