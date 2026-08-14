import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta a abrir al tocar la notificación. */
  url?: string;
  /** Avisos con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

// Envía a un solo dispositivo. Devuelve si se entregó.
export async function sendPushToOne(
  subscription: StoredSubscription,
  payload: PushPayload,
): Promise<boolean> {
  if (!configured()) return false;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    console.error("Error enviando notificación de prueba:", error);
    return false;
  }
}

// Envía el aviso a todos los dispositivos suscritos y limpia los que
// ya no existen (desinstalaron la app o revocaron el permiso).
// Nunca lanza: un fallo de notificaciones no debe tumbar la acción
// del admin que la disparó.
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!configured()) return 0;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const supabase = createAdminClient();
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (!subscriptions?.length) return 0;

    const body = JSON.stringify(payload);
    const expired: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          )
          .catch((error: unknown) => {
            const status = (error as { statusCode?: number })?.statusCode;
            // 404/410 = suscripción muerta.
            if (status === 404 || status === 410) expired.push(sub.id);
            throw error;
          }),
      ),
    );

    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return results.filter((r) => r.status === "fulfilled").length;
  } catch (error) {
    console.error("Error enviando notificaciones push:", error);
    return 0;
  }
}
