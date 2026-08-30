"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {isFarmMemberRole} from "@/lib/farmMembers";

async function ownerContext(farmId:string){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const{data:farm}=await supabase.from("farms").select("id,name,owner_id").eq("id",farmId).eq("owner_id",user.id).maybeSingle();
  if(!farm)throw new Error("Ehhez a gazdasághoz nincs kezelési jogosultságod.");
  return{supabase,user,farm};
}

export async function inviteFarmMember(formData:FormData){
  const farmId=String(formData.get("farm_id")||"");
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const fullName=String(formData.get("full_name")||"").trim();
  const memberRole=String(formData.get("member_role")||"operator");
  if(!farmId||!email.includes("@")||!fullName)throw new Error("Gazdaság, név és érvényes e-mail cím szükséges.");
  if(!isFarmMemberRole(memberRole))throw new Error("Érvénytelen munkatársi szerepkör.");
  if(fullName.length>120||email.length>250)throw new Error("A megadott adat túl hosszú.");
  const{supabase,user}=await ownerContext(farmId);
  const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")redirect("/mfa?next=/team");
  const{data:existing}=await supabase.from("farm_member_invites").select("id").eq("farm_id",farmId).eq("email",email).is("accepted_at",null).maybeSingle();
  if(existing)throw new Error("Erre az e-mail címre már van függő meghívó ennél a gazdaságnál.");
  const{data,error}=await supabase.functions.invoke("invite-farmer",{body:{email,full_name:fullName,farm_id:farmId,redirect_to:"https://agr-r-mentor.vercel.app/invite"}});
  if(error)throw new Error(`A fiókmeghívás sikertelen: ${error.message}`);if(data?.error)throw new Error(`A fiókmeghívás sikertelen: ${data.error}`);
  const{error:inviteError}=await supabase.from("farm_member_invites").insert({farm_id:farmId,email,full_name:fullName,member_role:memberRole,invited_by:user.id});
  if(inviteError)throw new Error(inviteError.message);
  revalidatePath("/team");
}

export async function updateFarmMember(formData:FormData){
  const memberId=String(formData.get("member_id")||"");const farmId=String(formData.get("farm_id")||"");const role=String(formData.get("member_role")||"");const active=String(formData.get("active")||"")==="true";
  if(!memberId||!farmId||!isFarmMemberRole(role))throw new Error("Hiányos vagy érvénytelen munkatársi adat.");
  const{supabase}=await ownerContext(farmId);
  const{error}=await supabase.from("farm_members").update({member_role:role,active,updated_at:new Date().toISOString()}).eq("id",memberId).eq("farm_id",farmId);
  if(error)throw new Error(error.message);revalidatePath("/team");revalidatePath("/tasks");
}
