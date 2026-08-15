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
const MAX_SOURCE = 1024; // techo para que el relleno no se vuelva lento

interface CrestEditorDialogProps {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
}

// Editor de escudos: quita el fondo y permite encuadrar.
//
// El borrado es un relleno por contigüidad desde las cuatro esquinas:
// solo desaparece lo que esté conectado al borde, así que un logo con
// negro adentro no queda hueco. Lo que no resuelve es cuando el fondo
// y el interior son del mismo color y se tocan — ahí la tolerancia
// alta se "cuela" y hay que dejarla baja o editar la imagen aparte.
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
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<ImageData | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [ready, setReady] = useState(false);
  const [removeBg, setRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Carga la imagen una vez en un canvas de trabajo.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, MAX_SOURCE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      sourceRef.current = canvas;
      originalRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setReady(true);
    };
    img.src = src;
  }, [src]);

  // Relleno por contigüidad desde las esquinas.
  const applyBackgroundRemoval = useCallback(() => {
    const canvas = sourceRef.current;
    const original = originalRef.current;
    if (!canvas || !original) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const data = new ImageData(
      new Uint8ClampedArray(original.data),
      original.width,
      original.height,
    );

    if (removeBg) {
      const { width: w, height: h } = data;
      const px = data.data;
      const visited = new Uint8Array(w * h);
      // La tolerancia del slider se mapea a distancia de color al cuadrado.
      const limit = tolerance * tolerance * 3;

      const seeds = [0, w - 1, (h - 1) * w, h * w - 1];
      const stack: number[] = [];

      for (const seed of seeds) {
        const i = seed * 4;
        const sr = px[i];
        const sg = px[i + 1];
        const sb = px[i + 2];
        stack.push(seed);

        while (stack.length > 0) {
          const p = stack.pop()!;
          if (visited[p]) continue;
          visited[p] = 1;

          const o = p * 4;
          if (px[o + 3] === 0) continue;
          const dr = px[o] - sr;
          const dg = px[o + 1] - sg;
          const db = px[o + 2] - sb;
          if (dr * dr + dg * dg + db * db > limit) continue;

          px[o + 3] = 0;

          const x = p % w;
          const y = (p / w) | 0;
          if (x > 0) stack.push(p - 1);
          if (x < w - 1) stack.push(p + 1);
          if (y > 0) stack.push(p - w);
          if (y < h - 1) stack.push(p + w);
        }
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(data, 0, 0);
  }, [removeBg, tolerance]);

  // Dibuja el resultado sobre un tablero de transparencia.
  const draw = useCallback(() => {
    const canvas = previewRef.current;
    const source = sourceRef.current;
    if (!canvas || !source) return;
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

    const base = VIEW / Math.max(source.width, source.height);
    const scale = base * zoom;
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, VIEW / 2 - w / 2 + offset.x, VIEW / 2 - h / 2 + offset.y, w, h);
  }, [zoom, offset]);

  useEffect(() => {
    if (!ready) return;
    applyBackgroundRemoval();
    draw();
  }, [ready, applyBackgroundRemoval, draw]);

  function confirm() {
    const source = sourceRef.current;
    if (!source) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const factor = OUTPUT / VIEW;
    const base = VIEW / Math.max(source.width, source.height);
    const scale = base * zoom * factor;
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(
      source,
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

      <label className="flex w-full items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={removeBg}
          onChange={(e) => setRemoveBg(e.target.checked)}
          className="accent-[#ccff00]"
        />
        Quitar el fondo
      </label>

      {removeBg ? (
        <div className="w-full space-y-1">
          <Label className="text-xs text-muted-foreground">
            Tolerancia: {tolerance}
          </Label>
          <input
            type="range"
            min={1}
            max={60}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-full accent-[#ccff00]"
          />
          <p className="text-xs text-muted-foreground">
            Súbela si queda borde del fondo. Bájala si el escudo empieza a
            quedar hueco por dentro.
          </p>
        </div>
      ) : null}

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
