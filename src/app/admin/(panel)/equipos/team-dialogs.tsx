"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
import type { Team } from "@/lib/types";
import { ColorSwatches } from "./color-swatches";
import { deleteTeam, updateTeam } from "./actions";

export function EditTeamDialog({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Editar equipo">
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            EDITAR EQUIPO
          </DialogTitle>
        </DialogHeader>
        <form
          action={async (formData: FormData) => {
            try {
              await updateTeam(team.id, formData);
              setOpen(false);
            } catch {
              toast.error("No se pudo guardar. ¿Nombre repetido?");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`name-${team.id}`}>Nombre</Label>
            <Input
              id={`name-${team.id}`}
              name="name"
              defaultValue={team.name}
              maxLength={40}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorSwatches defaultValue={team.color ?? undefined} />
          </div>
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTeamButton({ team }: { team: Team }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      title="Borrar equipo"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Borrar "${team.name}"? Sus jugadores quedan sin equipo.`)) {
          return;
        }
        startTransition(async () => {
          try {
            await deleteTeam(team.id);
          } catch {
            toast.error("No se pudo borrar el equipo");
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
    </Button>
  );
}
