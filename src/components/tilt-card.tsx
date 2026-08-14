"use client";

import { useEffect, useRef } from "react";
import { MOTION_EVENT, motionActive, motionSupported } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Misma forma de la carta (player-card.tsx) para que el brillo no se salga.
const CARD_CLIP =
  "[clip-path:polygon(0_3%,50%_0,100%_3%,100%_90%,50%_100%,0_90%)]";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Tilt 3D estilo FIFA Ultimate Team.
// Desktop: la carta sigue el cursor. Táctil: sigue el giroscopio —
// se activa con el botón "movimiento" (MotionButton) por el permiso de iOS.
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
    el.style.transform = `perspective(700px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale(1.05)`;
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

    if (!motionSupported()) {
      return () => observer.disconnect();
    }

    let baseline: { beta: number; gamma: number } | null = null;
    let raf = 0;
    let listening = false;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null || !visible.current) return;
      baseline ??= { beta: event.beta, gamma: event.gamma };
      // /18 y tope 0.75 → hasta ~12° de giro: se siente, sin marear.
      const x = clamp((event.gamma - baseline.gamma) / 18, -0.75, 0.75);
      const y = clamp((event.beta - baseline.beta) / 18, -0.75, 0.75);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(x, y));
    };

    // Prende/apaga según permiso + preferencia del usuario.
    const sync = () => {
      if (motionActive()) {
        if (!listening) {
          listening = true;
          window.addEventListener("deviceorientation", onOrientation);
        }
      } else if (listening) {
        listening = false;
        baseline = null;
        window.removeEventListener("deviceorientation", onOrientation);
        reset();
      }
    };

    sync();
    window.addEventListener(MOTION_EVENT, sync);

    return () => {
      observer.disconnect();
      window.removeEventListener(MOTION_EVENT, sync);
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
            "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgb(255 255 255 / 30%), transparent 60%)",
        }}
      />
    </div>
  );
}
