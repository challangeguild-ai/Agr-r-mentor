"use server";
import {createClient} from "@/lib/supabase/server";

export async function acceptPendingFarmMemberships(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user||!user.email)return{joined:0};
 const email=user.email.trim().toLowerCase();const{data:invites,error}=await supabase.from("farm_member_invites").select("id,farm_id,member_role").eq("email",email).is("accepted_at",null);if(error)throw new Error(error.message);
 let joined=0;for(const invite of invites??[]){const{error:memberError}=await supabase.from("farm_members").upsert({farm_id:invite.farm_id,user_id:user.id,member_role:invite.member_role,active:true,invited_by:null,updated_at:new Date().toISOString()},{onConflict:"farm_id,user_id"});if(memberError)throw new Error(memberError.message);const{error:acceptError}=await supabase.from("farm_member_invites").update({accepted_at:new Date().toISOString()}).eq("id",invite.id);if(acceptError)throw new Error(acceptError.message);joined++}
 return{joined};
}
