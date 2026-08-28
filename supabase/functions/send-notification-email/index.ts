import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  if(!resend)return json({error:"A RESEND_API_KEY nincs beállítva a Supabase Edge Function titkai között."},500);

  const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser(jwt);
  if(userError||!user)return json({error:"Érvénytelen munkamenet."},401);

  const body=await req.json().catch(()=>({}));
  const targetUserId=String(body.target_user_id||""),subject=String(body.subject||"").trim(),message=String(body.message||"").trim(),href=String(body.href||"").trim();
  if(!targetUserId||!subject||!message)return json({error:"Hiányzó címzett, tárgy vagy üzenet."},400);
  if(subject.length>200||message.length>5000)return json({error:"Az értesítés túl hosszú."},400);
  if(href&&(!href.startsWith("/")||href.startsWith("//")))return json({error:"Érvénytelen hivatkozás."},400);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:senderProfile},{data:targetProfile}]=await Promise.all([
    admin.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle(),
    admin.from("profiles").select("role,system_role").eq("id",targetUserId).maybeSingle()
  ]);
  const senderRole=senderProfile?.role,targetRole=targetProfile?.role;
  const senderIsAdvisor=senderRole==="advisor"&&senderProfile?.system_role!=="admin";
  const targetIsAdvisor=targetRole==="advisor"&&targetProfile?.system_role!=="admin";
  let allowed=false;
  if(senderIsAdvisor&&targetRole==="farmer")allowed=true;
  if(senderRole==="farmer"&&targetIsAdvisor)allowed=true;
  if(user.id===targetUserId)allowed=true;
  if(!allowed)return json({error:"Ehhez az értesítéshez nincs jogosultság."},403);

  const {data:target,error:targetError}=await admin.auth.admin.getUserById(targetUserId);
  const email=target?.user?.email;
  if(targetError||!email)return json({error:"A címzett e-mail címe nem található."},404);
  const appUrl="https://agr-r-mentor.vercel.app";
  const link=href?`${appUrl}${href}`:appUrl;
  const from=Deno.env.get("NOTIFICATION_EMAIL_FROM")||"Agrár Mentor <noreply@uniqerastudio.hu>";
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#24372d"><h2 style="color:#174a32">Agrár Mentor</h2><h3>${esc(subject)}</h3><p style="line-height:1.6">${esc(message).replace(/\n/g,"<br>")}</p><p><a href="${link}" style="display:inline-block;background:#174a32;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Megnyitás az Agrár Mentorban</a></p><p style="font-size:12px;color:#6f7c74">Ez egy automatikus értesítés az Agrár Mentor rendszerből.</p></div>`})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){console.error("Resend error",response.status,result);return json({error:"Az e-mail küldése sikertelen."},502)}
  return json({sent:true,id:result?.id||null});
 }catch(e){console.error("send-notification-email",e);return json({error:e instanceof Error?e.message:"Ismeretlen hiba."},500)}
});
