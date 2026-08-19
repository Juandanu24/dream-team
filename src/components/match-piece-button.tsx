"use client";

import { useState } from "react";
import { ImageDown, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  postFileName,
  renderPostImage,
  type PostImageData,
  type ScorerLine,
  type TeamSide,
} from "@/lib/post-image";

// Genera la pieza de Instagram del resultado sin salir de Resultados:
// el caso normal es cargar el marcador y querer publicarlo enseguida.
export function MatchPieceButton({
  eyebrow,
  home,
  away,
  when,
  venue,
  homeScorers,
  awayScorers,
}: {
  eyebrow: string;
  home: TeamSide;
  away: TeamSide;
  when: string;
  venue: string;
  homeScorers: ScorerLine[];
  awayScorers: ScorerLine[];
}) {
  const [busy, setBusy] = useState(false);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function handleClick() {
    setBusy(true);
    try {
      const piece: PostImageData = {
        kind: "resultado",
        format: "feed",
        eyebrow,
        headline: "Resultado",
        home,
        away,
        when,
        venue,
        homeScorers,
        awayScorers,
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
      toast.success("Pieza descargada");
    } catch (error) {
      // Cancelar el diálogo de compartir no es un error que valga avisar.
      if ((error as Error)?.name !== "AbortError") {
        toast.error("No se pudo generar la pieza");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={handleClick}
      title="Generar la imagen del resultado para Instagram"
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : canShareFiles ? (
        <Share2 aria-hidden />
      ) : (
        <ImageDown aria-hidden />
      )}
      Pieza IG
    </Button>
  );
}
