"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdvisor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "advisor") redirect("/dashboard");
  return { supabase };
}

async function extractFunctionError(error: unknown) {
  if (!error || typeof error !== "object") return "Ismeretlen Edge Function hiba.";

  const candidate = error as { message?: string; context?: Response };
  if (candidate.context) {
    try {
      const payload = await candidate.context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await candidate.context.clone().text();
        if (text) return text;
      } catch {}
    }
  }

  return candidate.message || "Ismeretlen Edge Function hiba.";
}

export async function inviteFarmer(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") || "").trim();

  if (!email || !email.includes("@") || !full_name) {
    throw new Error("Név és érvényes e-mail cím szükséges.");
  }

  const redirect_to = "https://agr-r-mentor.vercel.app/invite";
  const { data, error } = await supabase.functions.invoke("invite-farmer", {
    body: { email, full_name, redirect_to },
  });

  if (error) {
    const detail = await extractFunctionError(error);
    throw new Error(`A meghívás sikertelen: ${detail}`);
  }
  if (data?.error) throw new Error(`A meghívás sikertelen: ${data.error}`);

  revalidatePath("/admin");
}

export async function createFarm(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const owner_id = String(formData.get("owner_id") || "");
  const name = String(formData.get("name") || "").trim();
  const settlement = String(formData.get("settlement") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!owner_id || !name) return;

  const { error } = await supabase.from("farms").insert({
    owner_id,
    name,
    settlement: settlement || null,
    address: address || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createField(formData: FormData) {
  const { supabase } = await requireAdvisor();
  const farm_id = String(formData.get("farm_id") || "");
  const name = String(formData.get("name") || "").trim();
  const current_crop = String(formData.get("current_crop") || "").trim();
  const areaRaw = String(formData.get("area_ha") || "").replace(",", ".");
  const area_ha = areaRaw ? Number(areaRaw) : null;

  if (!farm_id || !name || (area_ha !== null && Number.isNaN(area_ha))) return;

  const { error } = await supabase.from("fields").insert({
    farm_id,
    name,
    current_crop: current_crop || null,
    area_ha,
    crop_year: new Date().getFullYear(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
