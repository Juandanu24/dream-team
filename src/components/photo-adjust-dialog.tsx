"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIEWPORT = 260; // px del recuadro de ajuste
const OUTPUT = 640; // px del recorte final

interface PhotoAdjustDialogProps {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File, previewUrl: string) => void;
}

// Ajuste de la foto antes de subirla: arrastrar para centrar + zoom.
// Exporta un recorte cuadrado listo para la carta.
// El estado vive en Adjuster, montado con key={src}: cada foto nueva
// empieza de cero y reabrir la misma conserva el encuadre.
export function PhotoAdjustDialog({
  src,
  open,
  onOpenChange,
  onConfirm,
}: PhotoAdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            AJUSTA TU FOTO
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Arrastra para centrarte y usa el zoom. El círculo es lo que se ve en
          la carta.
        </p>
        {src ? (
          <Adjuster
            key={src}
            src={src}
            onConfirm={(file, previewUrl) => {
              onConfirm(file, previewUrl);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Adjuster({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (file: File, previewUrl: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const cover = natural ? VIEWPORT / Math.min(natural.w, natural.h) : 1;
  const scale = cover * zoom;
  const drawnW = natural ? natural.w * scale : VIEWPORT;
  const drawnH = natural ? natural.h * scale : VIEWPORT;

  function clampOffset(x: number, y: number) {
    const maxX = Math.max(0, (drawnW - VIEWPORT) / 2);
    const maxY = Math.max(0, (drawnH - VIEWPORT) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setOffset(
      clampOffset(e.clientX - dragging.current.x, e.clientY - dragging.current.y),
    );
  }

  function handlePointerUp() {
    dragging.current = null;
  }

  function handleZoom(nextZoom: number) {
    setZoom(nextZoom);
    // Re-encuadrar por si el zoom out deja la imagen corta.
    const nextScale = cover * nextZoom;
    const nextW = (natural?.w ?? 0) * nextScale;
    const nextH = (natural?.h ?? 0) * nextScale;
    const maxX = Math.max(0, (nextW - VIEWPORT) / 2);
    const maxY = Math.max(0, (nextH - VIEWPORT) / 2);
    setOffset((prev) => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y)),
    }));
  }

  function confirm() {
    const img = imgRef.current;
    if (!img || !natural) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const left = VIEWPORT / 2 - drawnW / 2 + offset.x;
    const top = VIEWPORT / 2 - drawnH / 2 + offset.y;
    const sx = -left / scale;
    const sy = -top / scale;
    const sw = VIEWPORT / scale;

    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (webp) => {
        const finish = (blob: Blob, ext: string) => {
          const file = new File([blob], `foto.${ext}`, { type: blob.type });
          onConfirm(file, URL.createObjectURL(blob));
        };
        if (webp && webp.type === "image/webp") {
          finish(webp, "webp");
        } else {
          // Safari viejo no exporta webp: caemos a JPEG.
          canvas.toBlob((jpeg) => jpeg && finish(jpeg, "jpg"), "image/jpeg", 0.85);
        }
      },
      "image/webp",
      0.85,
    );
  }

  return (
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative touch-none overflow-hidden rounded-lg bg-black/60 select-none"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                alt="Foto a ajustar"
                draggable={false}
                onLoad={(e) =>
                  setNatural({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="absolute max-w-none"
                style={{
                  width: drawnW,
                  height: drawnH,
                  left: VIEWPORT / 2 - drawnW / 2 + offset.x,
                  top: VIEWPORT / 2 - drawnH / 2 + offset.y,
                }}
              />
            ) : null}
            {/* Guía circular: lo que muestra la carta */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                background:
                  "radial-gradient(circle at center, transparent 62%, rgb(0 0 0 / 55%) 63%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-volt/70"
            />
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            className="w-full accent-[#ccff00]"
            aria-label="Zoom"
          />
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button type="button" className="flex-1" onClick={confirm}>
              Usar foto
            </Button>
          </div>
        </div>
  );
}
