"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPaymentProofUrl, setPaymentVerified } from "./actions";

/** Ver el comprobante y marcar el pago.
 *
 *  La URL no se precarga para TODA la lista: se pide al abrir. Firmar 50
 *  URLs en cada render sería una llamada por inscrito y la mitad no se
 *  miran nunca. */
export function PaymentProofButton({
  registrationId,
  tienePago,
  verificado,
  nombre,
}: {
  registrationId: string;
  tienePago: boolean;
  verificado: boolean;
  nombre: string;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!tienePago) {
    return (
      <span
        className="text-[11px] text-muted-foreground"
        title="Se inscribió antes de que se pidiera comprobante, o pagó por fuera"
      >
        sin soporte
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        title={`Ver el comprobante de ${nombre}`}
        disabled={abriendo}
        onClick={async () => {
          setAbriendo(true);
          try {
            const url = await getPaymentProofUrl(registrationId);
            if (!url) {
              toast.error("No se pudo abrir el comprobante");
              return;
            }
            // Se abre en otra pestaña: la URL vence en un minuto, así que
            // no sirve de nada guardarla.
            window.open(url, "_blank", "noopener,noreferrer");
          } finally {
            setAbriendo(false);
          }
        }}
      >
        {abriendo ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Receipt aria-hidden />
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        title={verificado ? "Pago verificado — quitar" : "Marcar el pago como verificado"}
        className={cn(verificado && "text-volt-text")}
        onClick={() =>
          startTransition(async () => {
            try {
              await setPaymentVerified(registrationId, !verificado);
              toast.success(verificado ? "Pago sin verificar" : "Pago verificado");
            } catch {
              toast.error("No se pudo guardar");
            }
          })
        }
      >
        <BadgeCheck aria-hidden />
      </Button>
    </div>
  );
}
