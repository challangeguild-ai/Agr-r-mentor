"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {syncOfficialFieldWeather} from "@/lib/weather/sync";

export async function syncWeatherNow(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const[{data:aal},{data:profile}]=await Promise.all([
  supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle()
 ]);
 if(aal?.currentLevel!=="aal2")redirect(`/mfa?next=${encodeURIComponent("/system-admin/weather")}`);
 if(profile?.role!=="advisor"||profile?.system_role!=="admin")redirect(profile?.role==="advisor"?"/admin":"/dashboard");
 await syncOfficialFieldWeather();
 revalidatePath("/system-admin/weather");
 revalidatePath("/dashboard");
 revalidatePath("/fields");
}
