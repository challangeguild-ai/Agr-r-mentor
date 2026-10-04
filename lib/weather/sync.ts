import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {
 fetchHungaroMetDaily,
 fetchHungaroMetStations,
 nearestStation,
 HUNGAROMET_DAILY_DESCRIPTION_URL
} from "@/lib/weather/hungaromet";

const MAX_STATION_DISTANCE_KM=35;
const LOOKBACK_DAYS=45;
const STATION_FETCH_CONCURRENCY=5;

function fieldPoint(field:{center_lat:number|null;center_lng:number|null;boundary_geojson:any}){
 if(field.center_lat!=null&&field.center_lng!=null)return {lat:Number(field.center_lat),lng:Number(field.center_lng)};
 const geometry=field.boundary_geojson?.type==="Feature"?field.boundary_geojson.geometry:field.boundary_geojson;
 const ring=geometry?.type==="Polygon"?geometry.coordinates?.[0]:geometry?.type==="MultiPolygon"?geometry.coordinates?.[0]?.[0]:null;
 if(!Array.isArray(ring)||!ring.length)return null;
 const valid=ring.filter((p:any)=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
 if(!valid.length)return null;
 return {
  lng:valid.reduce((s:number,p:any)=>s+Number(p[0]),0)/valid.length,
  lat:valid.reduce((s:number,p:any)=>s+Number(p[1]),0)/valid.length
 };
}

async function mapLimit<T,R>(items:T[],limit:number,worker:(item:T)=>Promise<R>){
 const result=new Array<R>(items.length);
 let cursor=0;
 async function runner(){
  while(true){
   const index=cursor++;
   if(index>=items.length)return;
   result[index]=await worker(items[index]);
  }
 }
 await Promise.all(Array.from({length:Math.min(limit,Math.max(1,items.length))},()=>runner()));
 return result;
}

export async function syncOfficialFieldWeather(){
 const supabase=createAdminClient();
 const startedAt=new Date().toISOString();
 let runId:string|null=null;
 try{
  const{data:run}=await supabase.from("weather_sync_runs").insert({
   started_at:startedAt,
   status:"running",
   metadata:{provider:"HungaroMet",lookback_days:LOOKBACK_DAYS,max_station_distance_km:MAX_STATION_DISTANCE_KM}
  }).select("id").maybeSingle();
  runId=run?.id??null;

  const{data:fields,error:fieldError}=await supabase.from("fields").select("id,farm_id,name,center_lat,center_lng,boundary_geojson");
  if(fieldError)throw new Error(fieldError.message);

  const totalFields=fields?.length??0;
  const mappable=(fields??[]).map(field=>({field,point:fieldPoint(field)})).filter((x):x is typeof x&{point:{lat:number;lng:number}}=>!!x.point);
  if(!mappable.length){
   const result={ok:true,status:"success",fields:0,totalFields,stations:0,stationFailures:0,observations:0,timelineInserted:0,skippedFields:totalFields,source:"HungaroMet official daily automatic-station observations"};
   if(runId)await supabase.from("weather_sync_runs").update({finished_at:new Date().toISOString(),status:"success",fields_total:totalFields,fields_synced:0,fields_skipped:totalFields,stations_requested:0,stations_failed:0,observations_upserted:0,timeline_inserted:0}).eq("id",runId);
   return result;
  }

  const stations=await fetchHungaroMetStations();
  const assignments=mappable.map(({field,point})=>{
   const nearest=nearestStation(stations,point.lat,point.lng);
   if(!nearest||nearest.distanceKm>MAX_STATION_DISTANCE_KM)return null;
   return {field,point,...nearest};
  }).filter(Boolean) as Array<{field:any;point:{lat:number;lng:number};station:any;distanceKm:number}>;

  const uniqueStations=[...new Set(assignments.map(x=>x.station.stationNumber))];
  const stationResults=await mapLimit(uniqueStations,STATION_FETCH_CONCURRENCY,async stationNumber=>{
   try{return {stationNumber,ok:true as const,data:await fetchHungaroMetDaily(stationNumber)}}
   catch(error){return {stationNumber,ok:false as const,error:error instanceof Error?error.message:String(error)}}
  });
  const stationData=new Map<string,Awaited<ReturnType<typeof fetchHungaroMetDaily>>>();
  const stationErrors:Array<{stationNumber:string;error:string}>=[];
  for(const result of stationResults){
   if(result.ok)stationData.set(result.stationNumber,result.data);
   else stationErrors.push({stationNumber:result.stationNumber,error:result.error});
  }
  if(uniqueStations.length&&!stationData.size)throw new Error(`Minden HungaroMet állomáslekérés sikertelen (${stationErrors.length} állomás).`);

  const cutoff=new Date();
  cutoff.setUTCDate(cutoff.getUTCDate()-LOOKBACK_DAYS);
  const cutoffDate=cutoff.toISOString().slice(0,10);
  let upserted=0,timelineInserted=0,fieldsSynced=0;

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
    source_meta:{
     method:"nearest_official_automatic_station",
     measurement_period:"06_utc_to_next_06_utc",
     official_description_url:dataset.descriptionUrl,
     field_lat:assignment.point.lat,
     field_lng:assignment.point.lng
    }
   }));
   if(!rows.length)continue;

   const{data:stored,error}=await supabase.from("field_weather_daily")
    .upsert(rows,{onConflict:"field_id,weather_date,provider,station_number"})
    .select("id,field_id,weather_date,precipitation_mm,distance_km,station_name");
   if(error)throw new Error(`Weather upsert hiba (${assignment.field.name}): ${error.message}`);
   fieldsSynced++;
   upserted+=stored?.length??0;

   for(const weather of stored??[]){
    if(Number(weather.precipitation_mm)<=0)continue;
    const{data:existing}=await supabase.from("timeline_events").select("id").eq("source_id",weather.id).eq("event_type","weather_observation").maybeSingle();
    if(existing)continue;
    const rain=Number(weather.precipitation_mm).toLocaleString("hu-HU",{maximumFractionDigits:2});
    const distance=Number(weather.distance_km).toLocaleString("hu-HU",{maximumFractionDigits:1});
    const description=`${rain} mm mért napi csapadék · HungaroMet ${weather.station_name||assignment.station.stationNumber} állomás · ${distance} km a táblától · mérési időszak: 06–06 UTC`;
    const{error:timelineError}=await supabase.from("timeline_events").insert({
     farm_id:assignment.field.farm_id,
     field_id:assignment.field.id,
     event_type:"weather_observation",
     title:`Csapadék: ${rain} mm`,
     description,
     event_at:`${weather.weather_date}T12:00:00Z`,
     source_id:weather.id,
     technical_payload:{
      provider:"HungaroMet",
      source_type:"measured",
      station_number:assignment.station.stationNumber,
      distance_km:weather.distance_km,
      measurement_period:"06_utc_to_next_06_utc",
      official_description_url:HUNGAROMET_DAILY_DESCRIPTION_URL
     }
    });
    if(timelineError)throw new Error(`Weather timeline hiba: ${timelineError.message}`);
    timelineInserted++;
   }
  }

  const skippedFields=totalFields-fieldsSynced;
  const status=stationErrors.length||skippedFields?"partial":"success";
  const result={
   ok:true,
   status,
   totalFields,
   fields:fieldsSynced,
   stations:uniqueStations.length,
   stationFailures:stationErrors.length,
   stationErrors,
   observations:upserted,
   timelineInserted,
   skippedFields,
   maxStationDistanceKm:MAX_STATION_DISTANCE_KM,
   lookbackDays:LOOKBACK_DAYS,
   source:"HungaroMet official daily automatic-station observations",
   officialDescriptionUrl:HUNGAROMET_DAILY_DESCRIPTION_URL
  };
  if(runId)await supabase.from("weather_sync_runs").update({
   finished_at:new Date().toISOString(),
   status,
   fields_total:totalFields,
   fields_synced:fieldsSynced,
   fields_skipped:skippedFields,
   stations_requested:uniqueStations.length,
   stations_failed:stationErrors.length,
   observations_upserted:upserted,
   timeline_inserted:timelineInserted,
   error_summary:stationErrors,
   metadata:{provider:"HungaroMet",lookback_days:LOOKBACK_DAYS,max_station_distance_km:MAX_STATION_DISTANCE_KM,official_description_url:HUNGAROMET_DAILY_DESCRIPTION_URL}
  }).eq("id",runId);
  return result;
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(runId)await supabase.from("weather_sync_runs").update({finished_at:new Date().toISOString(),status:"failed",error_summary:[{error:message}]}).eq("id",runId);
  throw error;
 }
}
