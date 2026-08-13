import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente SSR con la sesión del usuario (cookies). Solo se usa para
// autenticación del admin: los datos del torneo se leen con el admin client.
export async function createSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un server component: las cookies se refrescan en el proxy.
          }
        },
      },
    },
  );
}

// Devuelve el usuario admin autenticado, o null si no hay sesión
// (o Supabase aún no está configurado).
export async function getAdminUser() {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
