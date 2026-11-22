import {NextRequest,NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {FinanceDenied,readAdvisorFinance} from "@/lib/advisorProfit";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const result=(body:object,status:number)=>NextResponse.json(body,{status,headers});

/** Native app endpoint. JWT verification, MFA, active grant and audit are all mandatory. */
export async function GET(req:NextRequest){
 const token=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.headers.get("authorization")??"")?.[1];
 if(!token)return result({error:"Bejelentkezés szükséges."},401);
 const farmId=req.nextUrl.searchParams.get("farm")??undefined;
 if(farmId&&!uuid.test(farmId))return result({error:"Érvénytelen gazdaságazonosító."},400);
 try{
  const db=createAdminClient();
  const{data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return result({error:"Érvénytelen vagy lejárt munkamenet."},401);
  // Decode only AFTER the Supabase Auth server has verified the access token.
  const claims=JSON.parse(Buffer.from(token.split(".")[1]??"","base64url").toString("utf8"));
  if(claims.aal!=="aal2")return result({error:"Kétfaktoros hitelesítés szükséges."},403);
  return result({farms:await readAdvisorFinance(user.id,farmId)},200);
 }catch(error){
  if(error instanceof FinanceDenied)return result({error:error.message},403);
  console.error("Naplózott szaktanácsadói pénzügyi lekérés sikertelen",error);
  return result({error:"A kimutatás jelenleg nem érhető el."},503);
 }
}
