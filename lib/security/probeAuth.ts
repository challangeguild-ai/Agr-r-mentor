import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

// Diagnostic endpoints make outbound requests to third-party sites. Keep them
// behind the same system-admin + MFA gate as the administrative screens.
export async function requireSystemAdminProbe(){
 const supabase=await createClient();
 const{data:{user},error:userError}=await supabase.auth.getUser();
 if(userError||!user)return NextResponse.json({error:"Bejelentkezés szükséges."},{status:401});
 const{data:profile,error:profileError}=await supabase.from("profiles")
  .select("role,system_role").eq("id",user.id).maybeSingle();
 if(profileError)return NextResponse.json({error:"A jogosultság nem ellenőrizhető."},{status:503});
 if(profile?.role!=="advisor"||profile.system_role!=="admin")
  return NextResponse.json({error:"Rendszeradminisztrátori jogosultság szükséges."},{status:403});
 const{data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aalError||aal?.currentLevel!=="aal2")
  return NextResponse.json({error:"Kétfaktoros hitelesítés szükséges."},{status:403});
 return null;
}
