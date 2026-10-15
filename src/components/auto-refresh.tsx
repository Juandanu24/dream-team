"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresca la página cada tantos segundos.
 *
 *  Para el sorteo en vivo: quien lo está siguiendo no tiene que recargar
 *  a mano. Es `router.refresh()` y no un `setInterval` con `fetch`
 *  porque vuelve a correr el componente de servidor y reemplaza el árbol
 *  sin perder el scroll ni el estado del cliente.
 *
 *  Se detiene cuando la pestaña no está visible: refrescar un sorteo que
 *  nadie está mirando es gastar batería y pegarle a Supabase de más. */
export function AutoRefresh({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => window.clearInterval(id);
  }, [router, segundos]);

  return null;
}
