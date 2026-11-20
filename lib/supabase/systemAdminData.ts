import "server-only";
import {createClient as createUserClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function createSystemAdminDataClient(){
 const userClient=await createUserClient();
 const{data:{user}}=await userClient.auth.getUser();
 if(!user)throw new Error("Nincs bejelentkezve.");
 const{data:profile}=await userClient.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor"||profile?.system_role!=="admin")throw new Error("Nincs rendszeradminisztrátori jogosultság.");
 if(process.env.SUPABASE_SERVICE_ROLE_KEY)return createAdminClient();
 return userClient;
}
