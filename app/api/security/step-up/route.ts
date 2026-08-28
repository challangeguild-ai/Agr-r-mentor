import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {issueStepUpGrant,STEP_UP_COOKIE,STEP_UP_TTL_SECONDS} from "@/lib/security/stepUp";

function clientMeta(req:NextRequest){return{ip:(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||null,country:req.headers.get("x-vercel-ip-country"),region:req.headers.get("x-vercel-ip-country-region"),city:req.headers.get("x-vercel-ip-city"),ua:req.headers.get("user-agent")}}
async function log(actor:string,event_type:string,severity:string,risk_score:number,req:NextRequest,detail:Record<string,unknown>){try{const admin=createAdminClient();const meta=clientMeta(req);await admin.from("security_events").insert({actor_user_id:actor,event_type,severity,risk_score,ip_address:meta.ip,country_code:meta.country,region:meta.region,city:meta.city,user_agent:meta.ua,request_path:req.nextUrl.pathname,method:"POST",subject_type:"sensitive_action",subject_id:"export",detail})}catch{}}

export async function POST(req:NextRequest){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Nincs bejelentkezve."},{status:401});
 let body:{code?:string;action?:string};try{body=await req.json()}catch{return NextResponse.json({error:"Hibás kérés."},{status:400})}
 if(body.action!=="export")return NextResponse.json({error:"Ismeretlen védett művelet."},{status:400});
 const code=(body.code||"").replace(/\s/g,"");
 if(!/^\d{6}$/.test(code))return NextResponse.json({error:"Adj meg egy 6 jegyű authenticator-kódot."},{status:400});
 const{data:factors,error:listError}=await supabase.auth.mfa.listFactors();
 const factor=factors?.totp?.find(f=>f.status==="verified");
 if(listError||!factor)return NextResponse.json({error:"Nincs aktív authenticator beállítva ehhez a fiókhoz."},{status:403});
 const{error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor.id,code});
 if(error){await log(user.id,"mfa_step_up_failed","medium",25,req,{reason:error.message});return NextResponse.json({error:"A hitelesítő kód nem fogadható el."},{status:401})}
 let token:string;try{token=issueStepUpGrant(user.id,"export")}catch{return NextResponse.json({error:"A szerver biztonsági kulcsa nincs beállítva."},{status:503})}
 await log(user.id,"mfa_step_up_success","info",0,req,{valid_for_seconds:STEP_UP_TTL_SECONDS});
 const response=NextResponse.json({ok:true,expiresIn:STEP_UP_TTL_SECONDS});
 response.cookies.set(STEP_UP_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/admin/backup",maxAge:STEP_UP_TTL_SECONDS});
 return response;
}
