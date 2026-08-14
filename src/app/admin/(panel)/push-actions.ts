"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import { sendPushToOne } from "@/lib/push";

export type TestPushResult = { ok: true } | { ok: false; error: string };

// Envía una notificación de prueba solo al dispositivo que la pide,
// para verificar sin molestar a los demás suscritos.
export async function sendTestPush(endpoint: string): Promise<TestPushResult> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: "No autorizado" };

  const parsed = z.url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "Dispositivo inválido" };

  const supabase = createAdminClient();
  const { data: subscription } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("endpoint", parsed.data)
    .maybeSingle();

  if (!subscription) {
    return {
      ok: false,
      error: "Este dispositivo no está suscrito. Activa los avisos primero.",
    };
  }

  const sent = await sendPushToOne(subscription, {
    title: "🔔 Prueba del Dream Team",
    body: "Si ves esto, los avisos están funcionando en este dispositivo.",
    url: "/torneo",
    tag: "prueba",
  });

  return sent
    ? { ok: true }
    : { ok: false, error: "No se pudo entregar la notificación" };
}
