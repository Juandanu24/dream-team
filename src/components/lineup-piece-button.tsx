"use client";

import { useState } from "react";
import { ImageDown, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  postFileName,
  renderPostImage,
  type LineupRow,
  type PostImageData,
  type TeamSide,
} from "@/lib/post-image";

// Genera la imagen de la cancha con la alineación, sin salir del editor.
export function LineupPieceButton({
  eyebrow,
  team,
  formation,
  rows,
  bench,
}: {
  eyebrow: string;
  team: TeamSide;
  formation: string;
  rows: LineupRow[];
  bench: string[];
}) {
  const [busy, setBusy] = useState(false);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const vacia = rows.every((r) => r.players.length === 0);

  async function handleClick() {
    setBusy(true);
    try {
      const piece: PostImageData = {
        kind: "alineacion",
        format: "feed",
        eyebrow,
        headline: team.name,
        team,
        formation,
        rows,
        bench,
      };
      const blob = await renderPostImage(piece);
      const file = new File([blob], postFileName(piece), { type: "image/png" });

      if (canShareFiles && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Imagen descargada");
    } catch (error) {
      // Cancelar el diálogo de compartir no es un error que valga avisar.
      if ((error as Error)?.name !== "AbortError") {
        toast.error("No se pudo generar la imagen");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || vacia}
      onClick={handleClick}
      title={
        vacia
          ? "Asigna titulares primero"
          : "Generar la imagen de la alineación"
      }
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : canShareFiles ? (
        <Share2 aria-hidden />
      ) : (
        <ImageDown aria-hidden />
      )}
      Imagen
    </Button>
  );
}
