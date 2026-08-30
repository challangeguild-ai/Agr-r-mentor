"use server";
import {createClient} from "@/lib/supabase/server";

export async function acceptPendingFarmMemberships(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user||!user.email)return{joined:0};
 const email=user.email.trim().toLowerCase();const{data:invites,error}=await supabase.from("farm_member_invites").select("id").eq("email",email).is("accepted_at",null);if(error)throw new Error(error.message);
 let joined=0;for(const invite of invites??[]){const{error:acceptError}=await supabase.rpc("accept_farm_member_invite",{p_invite_id:invite.id});if(acceptError)throw new Error(acceptError.message);joined++}
 return{joined};
}
