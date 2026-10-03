import {NextRequest,NextResponse} from "next/server";
import {syncOfficialFieldWeather} from "@/lib/weather/sync";

export const runtime="nodejs";
export const maxDuration=60;

function authorized(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret)return {ok:false,status:503,message:"CRON_SECRET nincs beállítva; az időjárási szinkron fail-closed módban marad."};
 return req.headers.get("authorization")===`Bearer ${secret}`?{ok:true,status:200,message:"ok"}:{ok:false,status:401,message:"Jogosulatlan cron kérés."};
}

export async function GET(req:NextRequest){
 const auth=authorized(req);
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.message},{status:auth.status});
 try{
  const result=await syncOfficialFieldWeather();
  return NextResponse.json(result);
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
 }
}
