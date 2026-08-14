"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Misma forma de la carta (player-card.tsx) para que el brillo no se salga.
const CARD_CLIP =
  "[clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)]";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Tilt 3D estilo FIFA Ultimate Team.
// Desktop: la carta sigue el cursor. Mobile: sigue el giroscopio
// (en iOS se activa con el primer toque, que es cuando el sistema
// permite pedir el permiso de movimiento).
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  function apply(x: number, y: number) {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `perspective(700px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale(1.04)`;
    el.style.setProperty("--glare-x", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--glare-y", `${(y + 0.5) * 100}%`);
    el.style.setProperty("--glare-opacity", "1");
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--glare-opacity", "0");
  }

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    // En táctil manda el giroscopio; el cursor solo aplica con mouse.
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    apply(
      (event.clientX - rect.left) / rect.width - 0.5,
      (event.clientY - rect.top) / rect.height - 0.5,
    );
  }

  function handleLeave(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    reset();
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Solo animar cartas visibles (importa en la galería/carrusel).
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        if (!entry.isIntersecting) reset();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    // Giroscopio solo en dispositivos táctiles (sin hover real).
    if (window.matchMedia("(hover: hover)").matches) {
      return () => observer.disconnect();
    }

    let baseline: { beta: number; gamma: number } | null = null;
    let raf = 0;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null || !visible.current) return;
      baseline ??= { beta: event.beta, gamma: event.gamma };
      const x = clamp((event.gamma - baseline.gamma) / 30, -1, 1) / 2;
      const y = clamp((event.beta - baseline.beta) / 30, -1, 1) / 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(x, y));
    };

    const start = () =>
      window.addEventListener("deviceorientation", onOrientation);

    type DOEWithPermission = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };
    const DOE = window.DeviceOrientationEvent as DOEWithPermission | undefined;
    let removeGesture: (() => void) | undefined;

    if (DOE && typeof DOE.requestPermission === "function") {
      const onGesture = () => {
        DOE.requestPermission!()
          .then((result) => {
            if (result === "granted") start();
          })
          .catch(() => {});
      };
      el.addEventListener("pointerdown", onGesture, { once: true });
      removeGesture = () => el.removeEventListener("pointerdown", onGesture);
    } else if (DOE) {
      start();
    }

    return () => {
      observer.disconnect();
      removeGesture?.();
      window.removeEventListener("deviceorientation", onOrientation);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onPointerCancel={handleLeave}
      className={cn(
        "relative transition-transform duration-200 ease-out will-change-transform",
        className,
      )}
    >
      {children}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          CARD_CLIP,
        )}
        style={{
          opacity: "var(--glare-opacity, 0)",
          background:
            "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgb(255 255 255 / 22%), transparent 55%)",
        }}
      />
    </div>
  );
}
