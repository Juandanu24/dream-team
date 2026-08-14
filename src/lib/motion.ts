"use client";

// Estado global del efecto de movimiento (giroscopio).
// - iOS exige pedir el permiso desde un gesto del usuario.
// - El usuario puede prender/apagar el efecto; se recuerda en localStorage.
// Las TiltCard escuchan MOTION_EVENT para reaccionar a cualquier cambio.

export const MOTION_EVENT = "dt:motion-changed";

const STORAGE_KEY = "dt-motion-enabled";

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

// ¿Hace falta pedir permiso? (iOS y similares)
export function motionNeedsPermission(): boolean {
  return typeof doe()?.requestPermission === "function" && !granted;
}

export function motionGranted(): boolean {
  return (
    granted || (Boolean(doe()) && typeof doe()?.requestPermission !== "function")
  );
}

// Preferencia del usuario (por defecto: encendido).
export function motionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== "0";
}

export function setMotionEnabled(value: boolean) {
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  window.dispatchEvent(new Event(MOTION_EVENT));
}

// El efecto corre solo si hay permiso Y el usuario lo tiene encendido.
export function motionActive(): boolean {
  return motionGranted() && motionEnabled();
}

export type MotionResult = "granted" | "denied" | "unsupported";

// Llamar SIEMPRE desde un gesto del usuario (click/touch).
export async function requestMotion(): Promise<MotionResult> {
  const DOE = doe();
  if (!DOE) return "unsupported";
  if (typeof DOE.requestPermission !== "function") {
    granted = true;
    window.dispatchEvent(new Event(MOTION_EVENT));
    return "granted";
  }
  try {
    const result = await DOE.requestPermission();
    if (result === "granted") {
      granted = true;
      window.dispatchEvent(new Event(MOTION_EVENT));
      return "granted";
    }
    return "denied";
  } catch {
    return "denied";
  }
}
