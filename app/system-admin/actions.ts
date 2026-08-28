"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

async function requireSystemAdmin(){
 const userClient=await createClient();const{data:{user}}=await userClient.auth.getUser();if(!user)throw new Error("Nincs bejelentkezve.");
 const{data:aal}=await userClient.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")throw new Error("Kétfaktoros hitelesítés szükséges.");
 const{data:p}=await userClient.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();if(p?.role!=="advisor"||p?.system_role!=="admin")throw new Error("Nincs rendszeradminisztrátori jogosultság.");
 return{userClient,admin:createAdminClient(),user};
}

export async function inviteAdvisor(formData:FormData){
 const{userClient}=await requireSystemAdmin();
 const email=String(formData.get("email")||"").trim().toLowerCase();
 const fullName=String(formData.get("full_name")||"").trim();
 if(!email||!email.includes("@"))throw new Error("Érvényes e-mail cím szükséges.");
 const{data,error}=await userClient.functions.invoke("invite-advisor",{body:{email,full_name:fullName||email}});
 if(error)throw new Error(`A szaktanácsadói meghívás sikertelen: ${error.message}`);
 if(!data?.invited||data?.role!=="advisor")throw new Error(data?.error||"A meghívó szolgáltatás nem igazolta vissza a sikeres szaktanácsadói meghívást.");
 revalidatePath("/system-admin/users");
 redirect(`/system-admin/users?invite=sent&email=${encodeURIComponent(email)}`);
}

export async function adminUpdateTaskStatus(formData:FormData){
 const{admin,user}=await requireSystemAdmin();const id=String(formData.get("task_id")||"");const status=String(formData.get("status")||"");const reason=String(formData.get("reason")||"").trim();if(!id||!['open','in_progress','submitted','done'].includes(status))throw new Error("Érvénytelen feladat vagy állapot.");if(reason.length<8)throw new Error("Az admin beavatkozáshoz legalább 8 karakteres indoklás szükséges.");
 const{data:before,error:readError}=await admin.from("tasks").select("id,title,status,farm_id,field_id,assigned_to,due_date").eq("id",id).maybeSingle();if(readError||!before)throw new Error("A feladat nem található.");
 const{data:after,error}=await admin.from("tasks").update({status}).eq("id",id).select("id,title,status,farm_id,field_id,assigned_to,due_date").single();if(error)throw new Error(error.message);
 const{error:auditError}=await admin.from("admin_audit_events").insert({actor_user_id:user.id,action:"task_status_repair",target_type:"task",target_id:id,reason,before_state:before,after_state:after,metadata:{source:"system-admin/support"}});if(auditError)throw new Error(`A módosítás sikerült, de az auditnapló írása hibázott: ${auditError.message}`);
 revalidatePath("/system-admin");revalidatePath("/system-admin/support");
}
