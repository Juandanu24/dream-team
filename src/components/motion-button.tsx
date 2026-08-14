"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MOTION_EVENT,
  motionEnabled,
  motionNeedsPermission,
  motionSupported,
  requestMotion,
  setMotionEnabled,
} from "@/lib/motion";

type State = "hidden" | "need-permission" | "on" | "off";

// Prende/apaga el efecto de giroscopio. En iOS el primer toque además
// dispara el permiso de movimiento del sistema.
export function MotionButton() {
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    const sync = () => {
      if (!motionSupported()) return setState("hidden");
      if (motionNeedsPermission()) return setState("need-permission");
      setState(motionEnabled() ? "on" : "off");
    };
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, []);

  if (state === "hidden") return null;

  async function handleClick() {
    if (state === "need-permission") {
      const result = await requestMotion();
      if (result === "granted") {
        setMotionEnabled(true);
        toast.success("¡Listo! Mueve el teléfono y mira la carta");
      } else {
        toast.error(
          "El navegador bloqueó el sensor. Revisa los permisos de movimiento y orientación del sitio.",
        );
      }
      return;
    }
    setMotionEnabled(state !== "on");
  }

  return (
    <Button
      variant={state === "on" ? "secondary" : "outline"}
      size="sm"
      className="gap-2"
      onClick={handleClick}
    >
      <Smartphone aria-hidden />
      {state === "need-permission"
        ? "Activar efecto de movimiento"
        : state === "on"
          ? "Movimiento: ON"
          : "Movimiento: OFF"}
    </Button>
  );
}
