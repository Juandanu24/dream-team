"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/supabase/server";
import type { RegistrationStatus } from "@/lib/types";

async function setRegistrationStatus(id: string, status: RegistrationStatus) {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/admin/inscripciones");
  revalidatePath("/admin");
}

export async function approveRegistration(id: string) {
  await setRegistrationStatus(id, "approved");
}

export async function rejectRegistration(id: string) {
  await setRegistrationStatus(id, "rejected");
}

export async function resetRegistration(id: string) {
  await setRegistrationStatus(id, "pending");
}
