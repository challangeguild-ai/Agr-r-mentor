import {cookies,headers} from "next/headers";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {STEP_UP_COOKIE,verifyStepUpGrant} from "@/lib/security/stepUp";

export async function GET(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Nincs bejelentkezve."},{status:401});
 const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aal?.currentLevel!=="aal2")return NextResponse.json({error:"Kétfaktoros hitelesítés szükséges."},{status:403});
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor")return NextResponse.json({error:"Nincs jogosultság biztonsági mentéshez."},{status:403});
 const cookieStore=await cookies();
 let fresh=false;try{fresh=verifyStepUpGrant(cookieStore.get(STEP_UP_COOKIE)?.value,user.id,"export")}catch{return NextResponse.json({error:"A biztonsági exportkulcs nincs beállítva."},{status:503})}
 if(!fresh)return NextResponse.json({error:"Az exporthoz friss authenticator-megerősítés szükséges."},{status:428});
 const h=await headers();const ip=(h.get("x-forwarded-for")||"").split(",")[0].trim()||null;
 const{data,error}=await supabase.rpc("export_app_backup");
 if(error){await supabase.rpc("record_security_event",{p_event_type:"backup_export_failed",p_severity:"high",p_risk_score:45,p_ip_address:ip,p_country_code:h.get("x-vercel-ip-country"),p_region:h.get("x-vercel-ip-country-region"),p_city:h.get("x-vercel-ip-city"),p_user_agent:h.get("user-agent"),p_request_path:"/admin/backup/export",p_method:"GET",p_subject_type:"backup",p_subject_id:"full",p_detail:{reason:error.message}}).catch(()=>{});return NextResponse.json({error:error.message},{status:500})}
 await supabase.rpc("record_security_event",{p_event_type:"backup_export_success",p_severity:"medium",p_risk_score:10,p_ip_address:ip,p_country_code:h.get("x-vercel-ip-country"),p_region:h.get("x-vercel-ip-country-region"),p_city:h.get("x-vercel-ip-city"),p_user_agent:h.get("user-agent"),p_request_path:"/admin/backup/export",p_method:"GET",p_subject_type:"backup",p_subject_id:"full",p_detail:{fresh_mfa:true}}).catch(()=>{});
 cookieStore.delete(STEP_UP_COOKIE);
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 return new NextResponse(JSON.stringify(data,null,2),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="agrar-mentor-backup-${stamp}.json"`,"Cache-Control":"no-store, private","Pragma":"no-cache"}});
}
