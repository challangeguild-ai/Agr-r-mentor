"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function requireSystemAdmin(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Nincs bejelentkezve.");
 const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")throw new Error("Kétfaktoros hitelesítés szükséges.");
 const{data:p}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();if(p?.role!=="advisor"||p?.system_role!=="admin")throw new Error("Nincs rendszeradminisztrátori jogosultság.");
 return{supabase,user};
}

export async function adminUpdateTaskStatus(formData:FormData){
 const{supabase,user}=await requireSystemAdmin();const id=String(formData.get("task_id")||"");const status=String(formData.get("status")||"");const reason=String(formData.get("reason")||"").trim();if(!id||!['open','in_progress','submitted','done'].includes(status))throw new Error("Érvénytelen feladat vagy állapot.");if(reason.length<8)throw new Error("Az admin beavatkozáshoz legalább 8 karakteres indoklás szükséges.");
 const{data:before,error:readError}=await supabase.from("tasks").select("id,title,status,farm_id,field_id,assigned_to,due_date").eq("id",id).maybeSingle();if(readError||!before)throw new Error("A feladat nem található.");
 const{data:after,error}=await supabase.from("tasks").update({status}).eq("id",id).select("id,title,status,farm_id,field_id,assigned_to,due_date").single();if(error)throw new Error(error.message);
 const{error:auditError}=await supabase.from("admin_audit_events").insert({actor_user_id:user.id,action:"task_status_repair",target_type:"task",target_id:id,reason,before_state:before,after_state:after,metadata:{source:"system-admin/support"}});if(auditError)throw new Error(`A módosítás sikerült, de az auditnapló írása hibázott: ${auditError.message}`);
 revalidatePath("/system-admin");revalidatePath("/system-admin/support");revalidatePath("/admin/tasks");
}
