import {NextRequest,NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {fetchHungaroMetDaily,fetchHungaroMetStations,nearestStation} from "@/lib/weather/hungaromet";

export const runtime="nodejs";
export const maxDuration=60;

function fieldPoint(field:{center_lat:number|null;center_lng:number|null;boundary_geojson:any}){
 if(field.center_lat!=null&&field.center_lng!=null)return {lat:Number(field.center_lat),lng:Number(field.center_lng)};
 const geometry=field.boundary_geojson?.type==="Feature"?field.boundary_geojson.geometry:field.boundary_geojson;
 const ring=geometry?.type==="Polygon"?geometry.coordinates?.[0]:geometry?.type==="MultiPolygon"?geometry.coordinates?.[0]?.[0]:null;
 if(!Array.isArray(ring)||!ring.length)return null;
 const valid=ring.filter((p:any)=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
 if(!valid.length)return null;
 return {lng:valid.reduce((s:number,p:any)=>s+Number(p[0]),0)/valid.length,lat:valid.reduce((s:number,p:any)=>s+Number(p[1]),0)/valid.length};
}

function authorized(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret)return {ok:false,status:503,message:"CRON_SECRET nincs beállítva; az időjárási szinkron fail-closed módban marad."};
 return req.headers.get("authorization")===`Bearer ${secret}`?{ok:true,status:200,message:"ok"}:{ok:false,status:401,message:"Jogosulatlan cron kérés."};
}

export async function GET(req:NextRequest){
 const auth=authorized(req);
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.message},{status:auth.status});

 const supabase=createAdminClient();
 const{data:fields,error:fieldError}=await supabase.from("fields").select("id,farm_id,name,center_lat,center_lng,boundary_geojson");
 if(fieldError)return NextResponse.json({ok:false,error:fieldError.message},{status:500});

 const mappable=(fields??[]).map(field=>({field,point:fieldPoint(field)})).filter((x):x is typeof x&{point:{lat:number;lng:number}}=>!!x.point);
 if(!mappable.length)return NextResponse.json({ok:true,fields:0,observations:0,skipped:"Nincs térképi koordinátával rendelkező tábla."});

 const stations=await fetchHungaroMetStations();
 const assignments=mappable.map(({field,point})=>{const nearest=nearestStation(stations,point.lat,point.lng);return nearest?{field,point,...nearest}:null}).filter(Boolean) as Array<{field:any;point:{lat:number;lng:number};station:any;distanceKm:number}>;
 const uniqueStations=[...new Set(assignments.map(x=>x.station.stationNumber))];
 const stationData=new Map<string,Awaited<ReturnType<typeof fetchHungaroMetDaily>>>();
 for(const stationNumber of uniqueStations)stationData.set(stationNumber,await fetchHungaroMetDaily(stationNumber));

 const cutoff=new Date();cutoff.setUTCDate(cutoff.getUTCDate()-35);
 const cutoffDate=cutoff.toISOString().slice(0,10);
 let upserted=0,timelineInserted=0;

 for(const assignment of assignments){
  const dataset=stationData.get(assignment.station.stationNumber);
  if(!dataset)continue;
  const rows=dataset.observations.filter(o=>o.date>=cutoffDate&&o.precipitationMm!=null).map(o=>({
   field_id:assignment.field.id,
   weather_date:o.date,
   source_type:"measured",
   provider:"HungaroMet",
   station_number:assignment.station.stationNumber,
   station_name:assignment.station.name,
   station_lat:assignment.station.latitude,
   station_lng:assignment.station.longitude,
   distance_km:Number(assignment.distanceKm.toFixed(2)),
   precipitation_mm:o.precipitationMm,
   temperature_min_c:o.temperatureMinC,
   temperature_max_c:o.temperatureMaxC,
   source_url:dataset.sourceUrl,
   source_file:dataset.sourceFile,
   fetched_at:new Date().toISOString(),
   source_meta:{method:"nearest_official_automatic_station",field_lat:assignment.point.lat,field_lng:assignment.point.lng}
  }));
  if(!rows.length)continue;
  const{data:stored,error}=await supabase.from("field_weather_daily").upsert(rows,{onConflict:"field_id,weather_date,provider,station_number"}).select("id,field_id,weather_date,precipitation_mm,distance_km,station_name");
  if(error)throw new Error(`Weather upsert hiba (${assignment.field.name}): ${error.message}`);
  upserted+=stored?.length??0;

  for(const weather of stored??[]){
   if(Number(weather.precipitation_mm)<=0)continue;
   const{data:existing}=await supabase.from("timeline_events").select("id").eq("source_id",weather.id).eq("event_type","weather_observation").maybeSingle();
   if(existing)continue;
   const description=`${Number(weather.precipitation_mm).toLocaleString("hu-HU",{maximumFractionDigits:2})} mm mért csapadék · HungaroMet ${weather.station_name||assignment.station.stationNumber} állomás · ${Number(weather.distance_km).toLocaleString("hu-HU",{maximumFractionDigits:1})} km a táblától`;
   const{error:timelineError}=await supabase.from("timeline_events").insert({
    farm_id:assignment.field.farm_id,
    field_id:assignment.field.id,
    event_type:"weather_observation",
    title:`Csapadék: ${Number(weather.precipitation_mm).toLocaleString("hu-HU",{maximumFractionDigits:2})} mm`,
    description,
    event_at:`${weather.weather_date}T12:00:00+02:00`,
    source_id:weather.id,
    technical_payload:{provider:"HungaroMet",source_type:"measured",station_number:assignment.station.stationNumber,distance_km:weather.distance_km}
   });
   if(timelineError)throw new Error(`Weather timeline hiba: ${timelineError.message}`);
   timelineInserted++;
  }
 }

 return NextResponse.json({ok:true,fields:assignments.length,stations:uniqueStations.length,observations:upserted,timelineInserted,source:"HungaroMet official daily automatic-station observations"});
}
