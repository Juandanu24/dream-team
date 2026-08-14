"use client";

import { useTransition } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestPush } from "./push-actions";

// Prueba los avisos enviando una notificación solo a este dispositivo.
export function PushTestButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            if (!("serviceWorker" in navigator)) {
              toast.error("Este navegador no soporta notificaciones");
              return;
            }
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              toast.error(
                "Activa los avisos en este dispositivo primero (botón de la campana).",
              );
              return;
            }
            const result = await sendTestPush(subscription.endpoint);
            if (result.ok) {
              toast.success("Enviada. Debería llegarte en unos segundos.");
            } else {
              toast.error(result.error);
            }
          } catch {
            toast.error("No se pudo enviar la prueba");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
      Enviar notificación de prueba
    </Button>
  );
}
