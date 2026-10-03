import {NextResponse} from "next/server";
import {fetchHungaroMetDaily,fetchHungaroMetStations} from "@/lib/weather/hungaromet";

export const runtime="nodejs";
export const maxDuration=30;

export async function GET(){
 if(process.env.VERCEL_ENV==="production")return new NextResponse(null,{status:404});
 try{
  const stations=await fetchHungaroMetStations();
  const errors:string[]=[];
  for(const station of stations.slice(0,12)){
   try{
    const daily=await fetchHungaroMetDaily(station.stationNumber);
    if(daily.observations.length){
     const last=daily.observations[daily.observations.length-1];
     return NextResponse.json({ok:true,stationCount:stations.length,station:{number:station.stationNumber,name:station.name,lat:station.latitude,lng:station.longitude},observationCount:daily.observations.length,last,sourceUrl:daily.sourceUrl});
    }
   }catch(error){errors.push(String(error))}
  }
  return NextResponse.json({ok:false,stationCount:stations.length,errors:errors.slice(0,5)},{status:502});
 }catch(error){
  return NextResponse.json({ok:false,error:String(error)},{status:502});
 }
}
