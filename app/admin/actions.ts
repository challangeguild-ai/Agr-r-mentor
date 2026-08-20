"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdvisor() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");
  const userId = claimsData.claims.sub as string;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "advisor") redirect("/dashboard");
  return { supabase, userId };
}

export async function inviteFarmer(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") || "").trim();
  if (!email || !email.includes("@")) return;

  const { error } = await supabase.functions.invoke("invite-farmer", {
    body: { email, full_name },
  });

  if (error) throw new Error(`A meghívás sikertelen: ${error.message}`);
  revalidatePath("/admin");
}

export async function createFarm(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const owner_id = String(formData.get("owner_id") || "");
  const name = String(formData.get("name") || "").trim();
  const settlement = String(formData.get("settlement") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!owner_id || !name) return;

  await supabase.from("farms").insert({ owner_id, name, settlement: settlement || null, address: address || null });
  revalidatePath("/admin");
}

export async function createField(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const farm_id = String(formData.get("farm_id") || "");
  const name = String(formData.get("name") || "").trim();
  const crop = String(formData.get("current_crop") || "").trim();
  const areaRaw = String(formData.get("area_ha") || "").replace(",", ".");
  const area_ha = areaRaw ? Number(areaRaw) : null;
  if (!farm_id || !name || (area_ha !== null && Number.isNaN(area_ha))) return;

  await supabase.from("fields").insert({ farm_id, name, current_crop: crop || null, area_ha, crop_year: new Date().getFullYear() });
  revalidatePath("/admin");
}
