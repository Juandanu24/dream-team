"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cardFileName, renderCardImage, type CardImageData } from "@/lib/card-image";

// Descarga la carta como PNG, o la comparte directo (WhatsApp, etc.)
// en los celulares que soportan compartir archivos.
export function CardShareButton({
  card,
  className,
}: {
  card: CardImageData;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function handleClick() {
    setBusy(true);
    try {
      const blob = await renderCardImage(card);
      const file = new File([blob], cardFileName(card.name), {
        type: "image/png",
      });

      if (canShareFiles && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Carta de ${card.name}`,
          text: `Mi carta del Dream Team ⚽`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Carta descargada");
      }
    } catch (error) {
      // Cancelar el diálogo de compartir no es un error que valga avisar.
      if ((error as Error)?.name !== "AbortError") {
        toast.error("No pudimos generar la imagen de la carta");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={busy}
      onClick={handleClick}
      title="Descargar o compartir la carta"
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : canShareFiles ? (
        <Share2 aria-hidden />
      ) : (
        <Download aria-hidden />
      )}
      Mi carta
    </Button>
  );
}
