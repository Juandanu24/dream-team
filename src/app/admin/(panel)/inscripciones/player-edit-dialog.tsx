"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Pencil } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoAdjustDialog } from "@/components/photo-adjust-dialog";
import { MemberSinceField } from "@/components/member-since-field";
import { FOOT_LABELS, POSITION_LABELS, type Player } from "@/lib/types";
import { updatePlayer, updatePlayerPhoto } from "./actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

// Edición de los datos de la carta de un jugador.
export function PlayerEditDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const [rawPhoto, setRawPhoto] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

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
          <Button type="submit" className="w-full">
            Guardar datos
          </Button>
        </form>

        {/* La foto va aparte del form de datos para no mezclar subidas */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label>Foto</Label>
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              <AvatarImage src={player.photo_url ?? undefined} alt="" />
              <AvatarFallback>
                {player.full_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file?.type.startsWith("image/")) return;
                setRawPhoto((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(file);
                });
                setAdjusting(true);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Camera aria-hidden />
              )}
              Cambiar foto
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vas a poder centrarla y hacerle zoom antes de guardar.
          </p>
        </div>

        <PhotoAdjustDialog
          src={rawPhoto}
          open={adjusting}
          onOpenChange={setAdjusting}
          onConfirm={(file) => {
            const formData = new FormData();
            formData.set("photo", file, file.name);
            startUpload(async () => {
              try {
                await updatePlayerPhoto(player.id, formData);
                toast.success("Foto actualizada");
                setOpen(false);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "No se pudo subir la foto",
                );
              }
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
