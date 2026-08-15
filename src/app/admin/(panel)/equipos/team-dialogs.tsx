"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUp, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { CrestEditorDialog } from "@/components/crest-editor-dialog";
import { TeamCrest } from "@/components/team-crest";
import type { Team } from "@/lib/types";
import { ColorSwatches } from "./color-swatches";
import {
  deleteTeam,
  removeTeamCrest,
  updateTeam,
  updateTeamCrest,
} from "./actions";

export function EditTeamDialog({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [rawCrest, setRawCrest] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const crestInputRef = useRef<HTMLInputElement>(null);

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

        {/* Escudo: va aparte del form de datos para no mezclar subidas */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label>Escudo</Label>
          <div className="flex items-center gap-3">
            <TeamCrest
              name={team.name}
              color={team.color}
              crestUrl={team.crest_url}
              className="size-10"
            />
            <input
              ref={crestInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file?.type.startsWith("image/")) return;
                setRawCrest((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(file);
                });
                setEditing(true);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => crestInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <ImageUp aria-hidden />
              )}
              {team.crest_url ? "Cambiar" : "Subir"}
            </Button>
            {team.crest_url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  startUpload(async () => {
                    try {
                      await removeTeamCrest(team.id);
                    } catch {
                      toast.error("No se pudo quitar el escudo");
                    }
                  })
                }
              >
                Quitar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG con fondo transparente. Vas a poder encuadrarlo antes de
            guardar. Sin escudo se usa el ícono con el color del equipo.
          </p>
        </div>

        <CrestEditorDialog
          src={rawCrest}
          open={editing}
          onOpenChange={setEditing}
          onConfirm={(file) => {
            const formData = new FormData();
            formData.set("crest", file, file.name);
            startUpload(async () => {
              try {
                await updateTeamCrest(team.id, formData);
                toast.success("Escudo actualizado");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "No se pudo subir el escudo",
                );
              }
            });
          }}
        />
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
