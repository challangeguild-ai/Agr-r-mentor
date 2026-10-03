import {NextResponse} from "next/server";
import {syncOfficialFieldWeather} from "@/lib/weather/sync";

export const runtime="nodejs";
export const maxDuration=60;

export async function GET(){
 if(process.env.VERCEL_ENV==="production")return new NextResponse(null,{status:404});
 try{
  return NextResponse.json(await syncOfficialFieldWeather());
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
 }
}
