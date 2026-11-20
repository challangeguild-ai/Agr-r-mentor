import {NextRequest,NextResponse} from "next/server";
import {syncOfficialFieldWeather} from "@/lib/weather/sync";
import {weatherCronHttpStatus} from "@/lib/weather/syncHelpers";

export const runtime="nodejs";
export const maxDuration=300;
export const dynamic="force-dynamic";

function authorized(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret)return {ok:false,status:503,message:"CRON_SECRET nincs beállítva; az időjárási szinkron fail-closed módban marad."};
 return req.headers.get("authorization")===`Bearer ${secret}`
  ?{ok:true,status:200,message:"ok"}
  :{ok:false,status:401,message:"Jogosulatlan cron kérés."};
}

export async function GET(req:NextRequest){
 const auth=authorized(req);
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.message},{status:auth.status,headers:{"Cache-Control":"no-store"}});
 try{
  const result=await syncOfficialFieldWeather();
  const httpStatus=weatherCronHttpStatus(result.totalFields,result.fields);
  if(httpStatus===503){
   console.error("HungaroMet cron: egyetlen meglévő tábla sem kapott mért adatot",{
    totalFields:result.totalFields,stations:result.stations,stationFailures:result.stationFailures
   });
  }
  return NextResponse.json(httpStatus===503?{
   ...result,ok:false,error:"Egyetlen meglévő földtáblához sem sikerült napi mérést menteni."
  }:result,{status:httpStatus,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("HungaroMet cron szinkronhiba",error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}
