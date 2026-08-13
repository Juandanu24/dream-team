"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe el email y la contraseña" };
  }

  try {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "Credenciales inválidas" };
    }
  } catch {
    return { error: "Supabase no está configurado todavía (mira SETUP.md)" };
  }

  redirect("/admin");
}
