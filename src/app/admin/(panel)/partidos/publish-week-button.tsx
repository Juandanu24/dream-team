"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishWeek } from "./actions";

// Anuncia una semana a los suscritos. Si ya se anunció, queda como
// "Publicado" pero se puede volver a enviar (por ejemplo si cambió una
// fecha después de haberla publicado).
export function PublishWeekButton({
  week,
  published,
}: {
  week: number;
  published: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={published ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      className={published ? "text-volt" : undefined}
      onClick={() => {
        const mensaje = published
          ? `La semana ${week} ya se publicó. ¿Volver a avisar con los datos actuales?`
          : `¿Avisar a todos la programación de la semana ${week}?`;
        if (!confirm(mensaje)) return;

        startTransition(async () => {
          try {
            const sent = await publishWeek(week);
            toast.success(
              sent > 0
                ? `Aviso enviado a ${sent} dispositivo${sent > 1 ? "s" : ""}`
                : "Publicada (nadie tiene los avisos activados aún)",
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "No se pudo publicar",
            );
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : published ? (
        <CheckCircle2 aria-hidden />
      ) : (
        <Megaphone aria-hidden />
      )}
      {published ? "Publicada" : "Publicar semana"}
    </Button>
  );
}
