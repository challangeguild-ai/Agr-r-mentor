import {cookies,headers} from "next/headers";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {STEP_UP_COOKIE,verifyStepUpGrant} from "@/lib/security/stepUp";

async function log(actor:string,event_type:string,severity:string,risk_score:number,detail:Record<string,unknown>){try{const h=await headers();const admin=createAdminClient();const ip=(h.get("x-forwarded-for")||"").split(",")[0].trim()||null;await admin.from("security_events").insert({actor_user_id:actor,event_type,severity,risk_score,ip_address:ip,country_code:h.get("x-vercel-ip-country"),region:h.get("x-vercel-ip-country-region"),city:h.get("x-vercel-ip-city"),user_agent:h.get("user-agent"),request_path:"/admin/backup/export",method:"GET",subject_type:"backup",subject_id:"full",detail})}catch{}}

export async function GET(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Nincs bejelentkezve."},{status:401});
 const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aal?.currentLevel!=="aal2")return NextResponse.json({error:"Kétfaktoros hitelesítés szükséges."},{status:403});
 const{data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor"||profile?.system_role!=="admin")return NextResponse.json({error:"Csak rendszeradminisztrátor készíthet biztonsági mentést."},{status:403});
 const cookieStore=await cookies();
 let fresh=false;try{fresh=verifyStepUpGrant(cookieStore.get(STEP_UP_COOKIE)?.value,user.id,"export")}catch{return NextResponse.json({error:"A biztonsági exportkulcs nincs beállítva."},{status:503})}
 if(!fresh){await log(user.id,"backup_export_without_fresh_mfa","high",60,{blocked:true});return NextResponse.json({error:"Az exporthoz friss authenticator-megerősítés szükséges."},{status:428})}
 const{data,error}=await supabase.rpc("export_app_backup");
 if(error){await log(user.id,"backup_export_failed","high",45,{reason:error.message});return NextResponse.json({error:error.message},{status:500})}
 await log(user.id,"backup_export_success","medium",10,{fresh_mfa:true,system_admin:true});
 cookieStore.delete(STEP_UP_COOKIE);
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 return new NextResponse(JSON.stringify(data,null,2),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="agrar-mentor-backup-${stamp}.json"`,"Cache-Control":"no-store, private","Pragma":"no-cache"}});
}
