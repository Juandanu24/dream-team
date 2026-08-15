"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Comparte un texto sin meterlo en una URL.
//
// El link wa.me obliga a codificar el mensaje en la URL, y al abrir
// WhatsApp Desktop (sobre todo en Windows) el manejador de protocolos
// del sistema corrompe los caracteres no-ASCII: los emojis y las tildes
// llegan como "�". Compartir nativo o copiar al portapapeles entregan
// el texto tal cual.
function puedeCompartir() {
  return typeof navigator !== "undefined" && "share" in navigator;
}

// El ícono depende de si el equipo puede compartir nativo o solo copiar.
// Se resuelve en el cliente para no romper la hidratación.
function ShareIcon() {
  const share = useSyncExternalStore(
    () => () => {},
    () => puedeCompartir(),
    () => false,
  );
  return share ? <Share2 aria-hidden /> : <Copy aria-hidden />;
}

export function ShareTextButton({
  text,
  label = "WhatsApp",
  title = "Compartir",
  className,
}: {
  text: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      // En celular abre la hoja de compartir con WhatsApp incluido.
      if (puedeCompartir()) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensaje copiado: pégalo en el grupo de WhatsApp");
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      // Si el portapapeles está bloqueado, al menos mostramos el texto.
      toast.error("No se pudo copiar. Selecciona y copia el mensaje a mano.");
      console.log(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      title={title}
      className={cn(
        "border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]",
        className,
      )}
      disabled={busy}
      onClick={handleClick}
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : copied ? (
        <Check aria-hidden />
      ) : (
        <ShareIcon />
      )}
      {copied ? "Copiado" : label}
    </Button>
  );
}
