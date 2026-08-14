"use client";

// Estado global del permiso de giroscopio.
// iOS exige pedir el permiso desde un gesto del usuario, así que la UI
// muestra un botón "activar movimiento" que llama a requestMotion();
// las TiltCard escuchan el evento para empezar a reaccionar.

export const MOTION_GRANTED_EVENT = "dt:motion-granted";

let granted = false;

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

function doe(): DOEWithPermission | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window.DeviceOrientationEvent as DOEWithPermission | undefined);
}

// ¿Es un dispositivo táctil con soporte de orientación?
export function motionSupported(): boolean {
  return Boolean(doe()) && !window.matchMedia("(hover: hover)").matches;
}

// ¿Hace falta el botón de activar? (iOS y similares)
export function motionNeedsPermission(): boolean {
  return typeof doe()?.requestPermission === "function" && !granted;
}

export function motionGranted(): boolean {
  return granted || (Boolean(doe()) && typeof doe()?.requestPermission !== "function");
}

function markGranted() {
  granted = true;
  window.dispatchEvent(new Event(MOTION_GRANTED_EVENT));
}

export type MotionResult = "granted" | "denied" | "unsupported";

// Llamar SIEMPRE desde un gesto del usuario (click/touch).
export async function requestMotion(): Promise<MotionResult> {
  const DOE = doe();
  if (!DOE) return "unsupported";
  if (typeof DOE.requestPermission !== "function") {
    markGranted();
    return "granted";
  }
  try {
    const result = await DOE.requestPermission();
    if (result === "granted") {
      markGranted();
      return "granted";
    }
    return "denied";
  } catch {
    return "denied";
  }
}
