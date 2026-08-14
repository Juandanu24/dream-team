"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  p256dh: z.string().min(10).max(255),
  auth: z.string().min(5).max(255),
  userAgent: z.string().max(300).optional(),
});

export type SubscribeResult = { ok: true } | { ok: false; error: string };

// Guarda (o refresca) la suscripción de este dispositivo.
export async function saveSubscription(
  input: z.input<typeof subscriptionSchema>,
): Promise<SubscribeResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Suscripción inválida" };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        user_agent: parsed.data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("Error guardando suscripción push:", error);
    return { ok: false, error: "No pudimos activar los avisos" };
  }
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (error) {
    console.error("Error borrando suscripción push:", error);
  }
}
