"use client";

import { useState } from "react";
import { ImageDown, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { renderCardImage, type CardImageData } from "@/lib/card-image";
import { renderPlayerPost } from "@/lib/post-image";

/** Pieza de la figura del partido: su carta con el encabezado encima. */
export function MvpPieceButton({
  card,
  eyebrow,
  caption,
}: {
  card: CardImageData;
  eyebrow: string;
  caption: string;
}) {
  const [busy, setBusy] = useState(false);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function handleClick() {
    setBusy(true);
    try {
      const carta = await renderCardImage(card);
      const pieza = await renderPlayerPost(carta, card.teamColor ?? null, {
        eyebrow,
        headline: "Figura del partido",
      });
      const slug = card.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const file = new File([pieza], `dt-figura-${slug || "jugador"}.png`, {
        type: "image/png",
      });

      if (canShareFiles && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        return;
      }

      const url = URL.createObjectURL(pieza);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Pieza descargada");
    } catch (error) {
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
      title="Generar la pieza de la figura del partido"
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : canShareFiles ? (
        <Share2 aria-hidden />
      ) : (
        <ImageDown aria-hidden />
      )}
      Pieza figura
    </Button>
  );
}
