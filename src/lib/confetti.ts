"use client";

// Celebración con los colores de la marca. Se carga bajo demanda para
// no meter la librería en el bundle inicial.
const COLORS = ["#ccff00", "#8fb300", "#f5f5f5", "#ffffff"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Ráfaga corta desde los dos costados, tipo gol de local.
export async function celebrate() {
  if (typeof window === "undefined" || prefersReducedMotion()) return;

  const confetti = (await import("canvas-confetti")).default;

  const shoot = (originX: number, angle: number) =>
    confetti({
      particleCount: 60,
      spread: 65,
      startVelocity: 45,
      angle,
      origin: { x: originX, y: 0.7 },
      colors: COLORS,
      disableForReducedMotion: true,
    });

  shoot(0.15, 60);
  shoot(0.85, 120);
  window.setTimeout(() => {
    shoot(0.3, 75);
    shoot(0.7, 105);
  }, 220);
}
