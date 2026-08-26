import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {issueStepUpGrant,STEP_UP_COOKIE,STEP_UP_TTL_SECONDS} from "@/lib/security/stepUp";

function clientMeta(req:NextRequest){return{ip:(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||null,country:req.headers.get("x-vercel-ip-country"),region:req.headers.get("x-vercel-ip-country-region"),city:req.headers.get("x-vercel-ip-city"),ua:req.headers.get("user-agent")}}

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
 const meta=clientMeta(req);
 const{error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor.id,code});
 if(error){await supabase.rpc("record_security_event",{p_event_type:"mfa_step_up_failed",p_severity:"medium",p_risk_score:25,p_ip_address:meta.ip,p_country_code:meta.country,p_region:meta.region,p_city:meta.city,p_user_agent:meta.ua,p_request_path:req.nextUrl.pathname,p_method:"POST",p_subject_type:"sensitive_action",p_subject_id:"export",p_detail:{reason:error.message}}).catch(()=>{});return NextResponse.json({error:"A hitelesítő kód nem fogadható el."},{status:401})}
 let token:string;try{token=issueStepUpGrant(user.id,"export")}catch{return NextResponse.json({error:"A szerver biztonsági kulcsa nincs beállítva."},{status:503})}
 await supabase.rpc("record_security_event",{p_event_type:"mfa_step_up_success",p_severity:"info",p_risk_score:0,p_ip_address:meta.ip,p_country_code:meta.country,p_region:meta.region,p_city:meta.city,p_user_agent:meta.ua,p_request_path:req.nextUrl.pathname,p_method:"POST",p_subject_type:"sensitive_action",p_subject_id:"export",p_detail:{valid_for_seconds:STEP_UP_TTL_SECONDS}}).catch(()=>{});
 const response=NextResponse.json({ok:true,expiresIn:STEP_UP_TTL_SECONDS});
 response.cookies.set(STEP_UP_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/admin/backup",maxAge:STEP_UP_TTL_SECONDS});
 return response;
}
