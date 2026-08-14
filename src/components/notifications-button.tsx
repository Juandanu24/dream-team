"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteSubscription,
  saveSubscription,
} from "@/app/(public)/notificaciones-actions";

type State =
  | "checking"
  | "unsupported"
  | "install-first"
  | "off"
  | "on"
  | "blocked";

// En iPhone las notificaciones web solo existen si la app está
// instalada en la pantalla de inicio.
function isIosSafari() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// El navegador entrega la llave pública en base64url; el API la pide
// como Uint8Array.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function NotificationsButton({
  withLabel = false,
  fullWidth = false,
  className,
}: {
  /** Muestra el texto además del ícono. */
  withLabel?: boolean;
  /** Ocupa todo el ancho, para el menú lateral. */
  fullWidth?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        return setState("unsupported");
      }

      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supported) {
        // En iPhone sin instalar, el API no existe: explicamos en vez
        // de esconder el botón.
        return setState(
          isIosSafari() && !isStandalone() ? "install-first" : "unsupported",
        );
      }
      if (Notification.permission === "denied") return setState("blocked");

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setState(subscription ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking" || state === "unsupported") return null;

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "blocked" : "off");
      toast.error("No diste permiso para los avisos");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      ),
    });

    const json = subscription.toJSON();
    const result = await saveSubscription({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      userAgent: navigator.userAgent.slice(0, 300),
    });

    if (result.ok) {
      setState("on");
      toast.success("Listo, te avisamos de resultados y partidos nuevos");
    } else {
      await subscription.unsubscribe();
      toast.error(result.error);
    }
  }

  async function disable() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await deleteSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
    toast.success("Avisos desactivados");
  }

  const Icon =
    state === "on"
      ? BellRing
      : state === "blocked"
        ? BellOff
        : state === "install-first"
          ? Smartphone
          : Bell;

  const label =
    state === "on"
      ? "Avisos activados"
      : state === "blocked"
        ? "Avisos bloqueados"
        : state === "install-first"
          ? "Instala la app para avisos"
          : "Activar avisos";

  return (
    <Button
      variant={state === "on" ? "secondary" : "outline"}
      size={withLabel ? "default" : "sm"}
      title={
        state === "blocked"
          ? "Los avisos están bloqueados en la configuración del navegador"
          : state === "on"
            ? "Avisos activados"
            : "Activar avisos del torneo"
      }
      className={cn(fullWidth && "w-full justify-start", className)}
      disabled={pending}
      onClick={() => {
        if (state === "install-first") {
          toast.info(
            "En iPhone: toca Compartir → «Agregar a inicio», abre la app desde ese ícono y ahí activa los avisos.",
            { duration: 8000 },
          );
          return;
        }
        if (state === "blocked") {
          toast.error(
            "Tienes los avisos bloqueados. Actívalos en los ajustes del navegador para este sitio.",
          );
          return;
        }
        startTransition(async () => {
          try {
            if (state === "on") {
              await disable();
            } else {
              await enable();
            }
          } catch {
            toast.error("No pudimos configurar los avisos en este dispositivo");
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      {withLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </Button>
  );
}
