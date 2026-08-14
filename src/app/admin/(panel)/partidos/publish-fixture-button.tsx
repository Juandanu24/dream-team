"use client";

import { useTransition } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishFixture } from "./actions";

// Anuncia el calendario a todos los suscritos. Va aparte de crear los
// partidos para poder armarlos y corregirlos sin mandar 10 avisos.
export function PublishFixtureButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "¿Avisar a todos que el calendario ya está listo? Les llega una notificación al celular.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          try {
            const sent = await publishFixture();
            toast.success(
              sent > 0
                ? `Aviso enviado a ${sent} dispositivo${sent > 1 ? "s" : ""}`
                : "Nadie tiene los avisos activados todavía",
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "No se pudo enviar el aviso",
            );
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <Megaphone aria-hidden />
      )}
      Publicar calendario y avisar
    </Button>
  );
}
