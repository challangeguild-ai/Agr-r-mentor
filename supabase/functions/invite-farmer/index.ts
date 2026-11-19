import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:corsHeaders});
function fail(message:string,status:number,meta?:unknown){console.error("invite-farmer error",{status,message,meta});return json({error:message},status)}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return fail("Nem támogatott kérés.",405);
 try{
  const authHeader=req.headers.get("Authorization");if(!authHeader)return fail("Nincs hitelesítés.",401);
  const jwt=authHeader.replace(/^Bearer\s+/i,"").trim();if(!jwt)return fail("Érvénytelen hitelesítési token.",401);
  const url=Deno.env.get("SUPABASE_URL"),anonKey=Deno.env.get("SUPABASE_ANON_KEY"),serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anonKey||!serviceRoleKey)return fail("A Supabase szerveroldali konfiguráció hiányos.",500);
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const{data:userData,error:userError}=await userClient.auth.getUser(jwt);if(userError||!userData.user)return fail("Érvénytelen munkamenet.",401,userError?.message);
  const{data:aal,error:aalError}=await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt);if(aalError)return fail("Az MFA állapot nem ellenőrizhető.",401,aalError.message);if(aal?.currentLevel!=="aal2")return fail("Ehhez a művelethez kétlépcsős hitelesítés szükséges.",403,{code:"MFA_REQUIRED"});
  const{data:profile,error:profileError}=await userClient.from("profiles").select("role,system_role").eq("id",userData.user.id).maybeSingle();if(profileError)return fail(`Profil ellenőrzési hiba: ${profileError.message}`,500);
  const body=await req.json().catch(()=>({}));const email=String(body.email||"").trim().toLowerCase(),fullName=String(body.full_name||"").trim(),redirectTo=String(body.redirect_to||"").trim(),farmId=String(body.farm_id||"").trim();
  if(!email||!/^\S+@\S+\.\S+$/.test(email)||email.length>250)return fail("Érvényes e-mail cím szükséges.",400);if(fullName.length>120)return fail("A név túl hosszú.",400);
  const expectedOrigin=Deno.env.get("APP_PUBLIC_ORIGIN")?.trim();
  if(!expectedOrigin)return fail("Az APP_PUBLIC_ORIGIN nincs beállítva a meghívó szolgáltatásban.",503);
  let configured:URL,destination:URL;
  try{configured=new URL(expectedOrigin);destination=redirectTo?new URL(redirectTo):new URL("/invite",configured)}
  catch{return fail("Hibás meghívási webcím.",400)}
  if(configured.protocol!=="https:"||configured.username||configured.password||configured.pathname!=="/"||configured.search||configured.hash
    ||destination.protocol!=="https:"||destination.origin!==configured.origin||destination.username||destination.password
    ||destination.pathname!=="/invite"||destination.search||destination.hash)
    return fail("Érvénytelen visszatérési cím.",400);
  const safeRedirect=destination.toString();
  const regularAdvisor=profile?.role==="advisor"&&profile?.system_role!=="admin";
  let farmOwner=false;
  if(profile?.role==="farmer"&&farmId){const{data:farm,error:farmError}=await userClient.from("farms").select("id").eq("id",farmId).eq("owner_id",userData.user.id).maybeSingle();if(farmError)return fail(`Gazdaság ellenőrzési hiba: ${farmError.message}`,500);farmOwner=!!farm}
  if(!regularAdvisor&&!farmOwner)return fail("Ehhez szaktanácsadói vagy gazdaságtulajdonosi jogosultság szükséges.",403,{role:profile?.role,system_role:profile?.system_role});
  const adminClient=createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:quotaAllowed,error:quotaError}=await adminClient.rpc("claim_invitation_email_send_quota",{p_sender_id:userData.user.id});
  if(quotaError){console.error("invite-farmer quota unavailable",quotaError);return fail("A meghívási védelem nem elérhető. Próbáld később.",503)}
  if(quotaAllowed!==true)return fail("Túl sok meghívás történt. Később újra próbálhatod.",429);
  const{data,error}=await adminClient.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName||email,role:"farmer"},redirectTo:safeRedirect});if(error)return fail(error.message,error.status||400,{code:error.code,name:error.name});
  if(data.user?.id){const{error:profileUpsertError}=await adminClient.from("profiles").upsert({id:data.user.id,full_name:fullName||email,role:"farmer",system_role:"user"},{onConflict:"id"});if(profileUpsertError)return fail(`A felhasználó létrejött, de a profil mentése sikertelen: ${profileUpsertError.message}`,500)}
  console.log("invite-farmer success",{userId:data.user?.id||null,actor:userData.user.id,mode:regularAdvisor?"advisor":"farm-owner",farmId:farmOwner?farmId:null});return json({id:data.user?.id,email:data.user?.email,invited:true,role:"farmer"});
 }catch(error){console.error("invite-farmer unhandled",error);return json({error:"A meghívó szolgáltatás átmenetileg nem elérhető."},503)}
});
