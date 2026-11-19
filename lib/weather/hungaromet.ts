import "server-only";
import {parseHungaroMetDailyCsv,parseHungaroMetStations,unzipOfficialCsv,type HungaroMetStation} from "./hungarometParsing";
export type {HungaroMetStation,HungaroMetDailyObservation} from "./hungarometParsing";
export {unzipOfficialCsv as unzipSingleText} from "./hungarometParsing";

export const HUNGAROMET_META_URL="https://odp.met.hu/climate/observations_hungary/meta/station_meta_auto.csv";
export const HUNGAROMET_DAILY_BASE="https://odp.met.hu/climate/observations_hungary/daily/recent";
export const HUNGAROMET_DAILY_DESCRIPTION_URL="https://odp.met.hu/climate/observations_hungary/daily/recent/Leiras_automata_napi-HABP_1D_akt-hu.pdf";
const REQUEST_TIMEOUT_MS=20_000;

async function officialDownload<T>(url:string,read:(res:Response)=>Promise<T>):Promise<T>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try{
  const res=await fetch(url,{
   cache:"no-store",
   signal:controller.signal,
   headers:{
    "user-agent":"Agrar-Mentor/2.1 (+official-HungaroMet-sync)",
    "accept":"text/csv,application/zip,text/plain,*/*"
   }
  });
  if(!res.ok)throw new Error(`HungaroMet ODP HTTP ${res.status}: ${url}`);
  // Keep the timeout active until the *whole body* has been read.
  return await read(res);
 }finally{clearTimeout(timeout)}
}

export async function fetchHungaroMetStations(){
 const csv=await officialDownload(HUNGAROMET_META_URL,res=>res.text());
 return parseHungaroMetStations(csv);
}

export function distanceKm(lat1:number,lng1:number,lat2:number,lng2:number){
 const r=6371,toRad=(x:number)=>x*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
 return 2*r*Math.asin(Math.sqrt(a));
}

export function nearestStation(stations:HungaroMetStation[],lat:number,lng:number){
 let best:{station:HungaroMetStation;distanceKm:number}|null=null;
 for(const station of stations){
  const distance=distanceKm(lat,lng,station.latitude,station.longitude);
  if(!best||distance<best.distanceKm)best={station,distanceKm:distance};
 }
 return best;
}

export async function fetchHungaroMetDaily(stationNumber:string){
 const sourceUrl=`${HUNGAROMET_DAILY_BASE}/HABP_1D_${stationNumber}_akt.zip`;
 const zip=await officialDownload(sourceUrl,res=>res.arrayBuffer());
 const observations=parseHungaroMetDailyCsv(unzipOfficialCsv(zip),stationNumber);
 if(!observations.length)throw new Error(`HungaroMet napi adatsor üres (${stationNumber}).`);
 return {
  sourceUrl,
  sourceFile:`HABP_1D_${stationNumber}_akt.zip`,
  descriptionUrl:HUNGAROMET_DAILY_DESCRIPTION_URL,
  observations
 };
}
