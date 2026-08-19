"use client";

import { useState } from "react";
import { Images, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { renderCardImage, type CardImageData } from "@/lib/card-image";
import { renderPlayerPost } from "@/lib/post-image";

/** Exporta las cartas de un equipo listas para el carrusel de Instagram:
 *  una imagen por jugador, todas en 1080×1350 y con el mismo marco. */
export function TeamCardsButton({
  teamName,
  teamColor,
  cards,
}: {
  teamName: string;
  teamColor: string | null;
  cards: CardImageData[];
}) {
  const [progreso, setProgreso] = useState<number | null>(null);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  function nombreArchivo(card: CardImageData, i: number) {
    const slug = card.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    // El prefijo numerado mantiene el orden al subirlas al carrusel.
    return `${String(i + 1).padStart(2, "0")}-${slug || "jugador"}.png`;
  }

  async function exportar() {
    if (cards.length === 0) return;
    setProgreso(0);
    try {
      const archivos: File[] = [];
      for (let i = 0; i < cards.length; i++) {
        const carta = await renderCardImage(cards[i]);
        const pieza = await renderPlayerPost(carta, teamColor);
        archivos.push(
          new File([pieza], nombreArchivo(cards[i], i), { type: "image/png" }),
        );
        setProgreso(i + 1);
      }

      // En el celular se entregan todas juntas al selector nativo, que es
      // justo lo que pide un carrusel. Instagram admite hasta 10 por post.
      if (canShareFiles && navigator.canShare({ files: archivos })) {
        try {
          await navigator.share({
            files: archivos,
            title: `Cartas de ${teamName}`,
          });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
          // Si compartir falla, cae a la descarga de siempre.
        }
      }

      // En escritorio se bajan una por una. El navegador pide permiso
      // para descargas múltiples la primera vez.
      for (const archivo of archivos) {
        const url = URL.createObjectURL(archivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = archivo.name;
        link.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.success(
        `${archivos.length} ${archivos.length === 1 ? "carta descargada" : "cartas descargadas"}`,
      );
    } catch {
      toast.error("No se pudieron generar las cartas");
    } finally {
      setProgreso(null);
    }
  }

  const trabajando = progreso !== null;

  return (
    <div className="space-y-1.5">
      <Button
        variant="outline"
        className="w-full"
        disabled={trabajando || cards.length === 0}
        onClick={exportar}
      >
        {trabajando ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : canShareFiles ? (
          <Share2 aria-hidden />
        ) : (
          <Images aria-hidden />
        )}
        {trabajando
          ? `Generando ${progreso}/${cards.length}…`
          : `${canShareFiles ? "Compartir" : "Descargar"} las ${cards.length} cartas`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Una imagen por jugador, todas en 1080×1350 con el mismo marco. Van
        numeradas para que conserven el orden en el carrusel.
      </p>
    </div>
  );
}
