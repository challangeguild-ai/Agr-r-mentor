import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","X-AgrarMentor-Email-Release":"2026-11-20-email-v1"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"Nem támogatott kérés."},405);
 try{
  const authHeader=req.headers.get("Authorization");if(!authHeader)return json({error:"Nincs hitelesítés."},401);
  const jwt=authHeader.replace(/^Bearer\s+/i,"").trim();if(!jwt)return json({error:"Érvénytelen hitelesítési token."},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!anon||!service)return json({error:"Hiányos szerverkonfiguráció."},500);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const{data:u,error:ue}=await userClient.auth.getUser(jwt);if(ue||!u.user)return json({error:"Érvénytelen munkamenet."},401);
  const{data:aal,error:aalError}=await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt);if(aalError)return json({error:"Az MFA állapot nem ellenőrizhető."},401);if(aal?.currentLevel!=="aal2")return json({error:"Ehhez a művelethez kétlépcsős hitelesítés szükséges.",code:"MFA_REQUIRED"},403);
  const{data:p,error:pe}=await userClient.from("profiles").select("role,system_role").eq("id",u.user.id).maybeSingle();if(pe)return json({error:pe.message},500);if(p?.role!=="advisor"||p?.system_role!=="admin")return json({error:"Ehhez rendszeradminisztrátori jogosultság szükséges."},403);
  const b=await req.json().catch(()=>({}));const email=String(b.email||"").trim().toLowerCase(),fullName=String(b.full_name||"").trim(),redirectTo=String(b.redirect_to||"").trim();
  if(!email||!/^\S+@\S+\.\S+$/.test(email)||email.length>250)return json({error:"Érvényes e-mail cím szükséges."},400);if(fullName.length>120)return json({error:"A név túl hosszú."},400);
  const expectedOrigin=Deno.env.get("APP_PUBLIC_ORIGIN")?.trim();
  if(!expectedOrigin)return json({error:"Az APP_PUBLIC_ORIGIN nincs beállítva a meghívó szolgáltatásban."},503);
  let configured:URL,destination:URL;
  try{configured=new URL(expectedOrigin);destination=redirectTo?new URL(redirectTo):new URL("/invite",configured)}
  catch{return json({error:"Hibás meghívási webcím."},400)}
  if(configured.protocol!=="https:"||configured.username||configured.password||configured.pathname!=="/"||configured.search||configured.hash
    ||destination.protocol!=="https:"||destination.origin!==configured.origin||destination.username||destination.password
    ||destination.pathname!=="/invite"||destination.search||destination.hash)
    return json({error:"Érvénytelen visszatérési cím."},400);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:quotaAllowed,error:quotaError}=await admin.rpc("claim_invitation_email_send_quota",{p_sender_id:u.user.id});
  if(quotaError){console.error("invite-advisor quota unavailable",quotaError);return json({error:"A meghívási védelem nem elérhető. Próbáld később."},503)}
  if(quotaAllowed!==true)return json({error:"Túl sok meghívás történt. Később újra próbálhatod."},429);
  const{data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName||email,role:"advisor"},redirectTo:destination.toString()});if(error)return json({error:error.message},error.status||400);
  if(data.user?.id){const{error:e}=await admin.from("profiles").upsert({id:data.user.id,full_name:fullName||email,role:"advisor",system_role:"user"},{onConflict:"id"});if(e)return json({error:`A meghívás létrejött, de a profil mentése sikertelen: ${e.message}`},500)}
  console.log("invite-advisor success",{userId:data.user?.id||null,actor:u.user.id});return json({id:data.user?.id,email:data.user?.email,invited:true,role:"advisor"});
 }catch(e){console.error("invite-advisor unhandled",e);return json({error:"A meghívó szolgáltatás átmenetileg nem elérhető."},503)}
});
