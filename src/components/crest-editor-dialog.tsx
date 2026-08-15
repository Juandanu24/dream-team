"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const VIEW = 300; // px del recuadro de trabajo
const OUTPUT = 512; // px del PNG final

interface CrestEditorDialogProps {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
}

// Encuadre del escudo antes de subirlo. Los escudos llegan en PNG con
// fondo transparente, así que aquí solo se centra y se ajusta el zoom;
// el lienzo del canvas es transparente y la exportación es PNG, de modo
// que la transparencia del original se conserva tal cual.
export function CrestEditorDialog({
  src,
  open,
  onOpenChange,
  onConfirm,
}: CrestEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            AJUSTAR ESCUDO
          </DialogTitle>
        </DialogHeader>
        {src ? (
          <Editor
            key={src}
            src={src}
            onConfirm={(file) => {
              onConfirm(file);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Editor({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setReady(true);
    };
    img.src = src;
  }, [src]);

  // Dibuja el escudo sobre un tablero, para ver dónde hay transparencia.
  const draw = useCallback(() => {
    const canvas = previewRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEW, VIEW);
    const tile = 12;
    for (let y = 0; y < VIEW; y += tile) {
      for (let x = 0; x < VIEW; x += tile) {
        ctx.fillStyle = ((x / tile + y / tile) | 0) % 2 ? "#2a2a2a" : "#3a3a3a";
        ctx.fillRect(x, y, tile, tile);
      }
    }

    const base = VIEW / Math.max(img.width, img.height);
    const scale = base * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(
      img,
      VIEW / 2 - w / 2 + offset.x,
      VIEW / 2 - h / 2 + offset.y,
      w,
      h,
    );
  }, [zoom, offset]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  function confirm() {
    const img = imageRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const factor = OUTPUT / VIEW;
    const base = VIEW / Math.max(img.width, img.height);
    const scale = base * zoom * factor;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(
      img,
      OUTPUT / 2 - w / 2 + offset.x * factor,
      OUTPUT / 2 - h / 2 + offset.y * factor,
      w,
      h,
    );

    canvas.toBlob((blob) => {
      if (blob) onConfirm(new File([blob], "escudo.png", { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={previewRef}
        width={VIEW}
        height={VIEW}
        className="touch-none rounded-lg border border-border/60 select-none"
        onPointerDown={(e) => {
          dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          setOffset({
            x: e.clientX - dragging.current.x,
            y: e.clientY - dragging.current.y,
          });
        }}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      />

      <p className="text-xs text-muted-foreground">
        Arrastra para centrarlo. El cuadriculado es transparencia.
      </p>

      <div className="w-full space-y-1">
        <Label className="text-xs text-muted-foreground">Zoom</Label>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-[#ccff00]"
        />
      </div>

      <div className="flex w-full gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="flex-1" onClick={confirm} disabled={!ready}>
          Usar escudo
        </Button>
      </div>
    </div>
  );
}
