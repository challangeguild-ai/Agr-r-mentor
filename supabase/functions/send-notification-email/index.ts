import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {normalizeNotificationEventKey,notificationEmailIdempotencyKey} from "../_shared/notificationIdempotency.ts";
import {authorizeNotificationEmail} from "../_shared/notificationAuthorization.ts";

const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]||c));

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"Nem támogatott kérés."},405);
 try{
  const authHeader=req.headers.get("Authorization");
  if(!authHeader)return json({error:"Nincs hitelesítés."},401);
  const jwt=authHeader.replace(/^Bearer\s+/i,"").trim();
  if(!jwt)return json({error:"Érvénytelen hitelesítési token."},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),resend=Deno.env.get("RESEND_API_KEY");
  if(!url||!anon||!service)return json({error:"Hiányos Supabase konfiguráció."},500);
  if(!resend)return json({error:"Az e-mail-szolgáltatás jelenleg nincs beállítva."},503);

  const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser(jwt);
  if(userError||!user)return json({error:"Érvénytelen munkamenet."},401);

  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Érvénytelen e-mail-kérés."},400);
  const targetUserId=String(body.target_user_id||""),subject=String(body.subject||"").trim(),message=String(body.message||"").trim(),href=String(body.href||"").trim();
  const eventKey=normalizeNotificationEventKey(body.event_key);
  if(!eventKey)return json({error:"Érvényes, mentett értesítési eseményazonosító szükséges."},400);
  if(!targetUserId||!subject||!message)return json({error:"Hiányzó címzett, tárgy vagy üzenet."},400);
  if(subject.length>200||message.length>5000)return json({error:"Az értesítés túl hosszú."},400);
  if(href&&(!href.startsWith("/")||href.startsWith("//")))return json({error:"Érvénytelen hivatkozás."},400);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:senderProfile,error:senderError},{data:targetProfile,error:profileError}]=await Promise.all([
    admin.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle(),
    admin.from("profiles").select("role,system_role").eq("id",targetUserId).maybeSingle()
  ]);
  if(senderError||profileError){console.error("Notification profile lookup failed",senderError||profileError);return json({error:"A címzési jogosultság ellenőrzése nem elérhető."},503)}
  if(!senderProfile||!targetProfile)return json({error:"A címzési jogosultság nem igazolható."},403);
  const allowed=await authorizeNotificationEmail(
   admin,user.id,targetUserId,eventKey,
   senderProfile.role,senderProfile.system_role,
   targetProfile.role,targetProfile.system_role
  );
  if(!allowed)return json({error:"Ehhez az értesítési eseményhez nincs címzési jogosultság."},403);

  const {data:target,error:targetError}=await admin.auth.admin.getUserById(targetUserId);
  const email=target?.user?.email;
  if(targetError||!email)return json({error:"A címzett e-mail címe nem található."},404);
  // Never send an email linking to an obsolete deployment if the current origin is missing.
  const configuredOrigin=Deno.env.get("APP_PUBLIC_ORIGIN")?.trim();
  if(!configuredOrigin)return json({error:"Az APP_PUBLIC_ORIGIN nincs beállítva az értesítési szolgáltatásban."},503);
  let appUrl:string;
  try{
    const origin=new URL(configuredOrigin);
    if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)
      return json({error:"Érvénytelen APP_PUBLIC_ORIGIN konfiguráció."},500);
    appUrl=origin.origin;
  }catch{return json({error:"Érvénytelen APP_PUBLIC_ORIGIN konfiguráció."},500)}
  const destination=new URL(href||"/",appUrl);
  if(destination.origin!==appUrl)return json({error:"Érvénytelen értesítési hivatkozás."},400);
  const link=destination.href;
  const from=Deno.env.get("NOTIFICATION_EMAIL_FROM")||"Agrár Mentor <noreply@uniqerastudio.hu>";
  // An authenticated client may invoke Edge Functions directly. A database
  // claim is atomic across Edge instances and prevents unlimited Resend sends.
  const {data:quotaAllowed,error:quotaError}=await admin.rpc("claim_notification_email_send_quota",{p_sender_id:user.id});
  if(quotaError){console.error("Notification quota unavailable",quotaError);return json({error:"Az értesítési védelem nem elérhető. Próbáld később."},503)}
  if(quotaAllowed!==true)return json({error:"Az e-mailes értesítések óránkénti vagy napi korlátját elérted."},429);
  const idempotencyKey=await notificationEmailIdempotencyKey({senderId:user.id,recipientId:targetUserId,recipientEmail:email,eventKey,from,subject,message,link});
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},signal:AbortSignal.timeout(15000),body:JSON.stringify({from,to:[email],subject,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#24372d"><h2 style="color:#174a32">Agrár Mentor</h2><h3>${esc(subject)}</h3><p style="line-height:1.6">${esc(message).replace(/\n/g,"<br>")}</p><p><a href="${esc(link)}" style="display:inline-block;background:#174a32;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Megnyitás az Agrár Mentorban</a></p><p style="font-size:12px;color:#6f7c74">Ez egy automatikus értesítés az Agrár Mentor rendszerből.</p></div>`})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){console.error("Resend error",response.status,result);return json({error:"Az e-mail küldése sikertelen."},502)}
  return json({sent:true,id:result?.id||null});
 }catch(e){console.error("send-notification-email",e);return json({error:"Az e-mail-szolgáltatás átmenetileg nem elérhető. Ellenőrizd az alkalmazás értesítéseit."},503)}
});
