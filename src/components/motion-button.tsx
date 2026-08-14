"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { motionNeedsPermission, requestMotion } from "@/lib/motion";

// Botón para activar el giroscopio en iOS (y navegadores que piden permiso).
// Solo aparece donde hace falta; en Android el efecto anda solo.
export function MotionButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(motionNeedsPermission());
  }, []);

  if (!show) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={async () => {
        const result = await requestMotion();
        if (result === "granted") {
          setShow(false);
          toast.success("¡Listo! Mueve el teléfono y mira la carta");
        } else {
          toast.error(
            "El navegador bloqueó el sensor de movimiento. Revisa los permisos de movimiento y orientación del sitio.",
          );
        }
      }}
    >
      <Smartphone aria-hidden /> Activar efecto de movimiento
    </Button>
  );
}
