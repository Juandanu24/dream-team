import "server-only";

import { createClient } from "@supabase/supabase-js";

// Cliente con service role: omite RLS. Solo puede importarse desde
// código de servidor (server components / server actions) — `server-only`
// revienta el build si algún componente cliente lo importa.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
