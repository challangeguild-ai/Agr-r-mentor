import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {
 fetchHungaroMetDaily,
 fetchHungaroMetStations,
 nearestStation,
 HUNGAROMET_DAILY_DESCRIPTION_URL
} from "@/lib/weather/hungaromet";
import {fieldPoint,fetchAllWeatherFields,weatherSyncStatus,planWeatherTimelineChanges} from "@/lib/weather/syncHelpers";

const MAX_STATION_DISTANCE_KM=35;
const LOOKBACK_DAYS=45;
const STATION_FETCH_CONCURRENCY=5;

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
  const{data:run,error:runError}=await supabase.from("weather_sync_runs").insert({
   started_at:startedAt,
   status:"running",
   metadata:{provider:"HungaroMet",lookback_days:LOOKBACK_DAYS,max_station_distance_km:MAX_STATION_DISTANCE_KM}
  }).select("id").maybeSingle();
  if(runError||!run?.id)throw new Error(`Időjárási szinkronnapló nem írható: ${runError?.message||"nem érkezett futásazonosító"}`);
  runId=run.id;

  const fields=await fetchAllWeatherFields(async(from,to)=>{
   const{data,error}=await supabase.from("fields").select("id,farm_id,name,center_lat,center_lng,boundary_geojson").order("id").range(from,to);
   return {data,error};
  });
  const totalFields=fields.length;
  const mappable=fields.map(field=>({field,point:fieldPoint(field)})).filter((x):x is typeof x&{point:{lat:number;lng:number}}=>!!x.point);
  const missingLocation=totalFields-mappable.length;
  if(!mappable.length){
   const status=weatherSyncStatus(totalFields,0,0);
   const warnings=missingLocation?[{reason:"Nincs használható térképi hely",count:missingLocation}]:[];
   const result={ok:true,status,fields:0,totalFields,stations:0,stationFailures:0,observations:0,timelineInserted:0,skippedFields:totalFields,warnings,source:"HungaroMet official daily automatic-station observations"};
   const{error:finishError}=await supabase.from("weather_sync_runs").update({finished_at:new Date().toISOString(),status,fields_total:totalFields,fields_synced:0,fields_skipped:totalFields,stations_requested:0,stations_failed:0,observations_upserted:0,timeline_inserted:0,error_summary:warnings}).eq("id",runId);
   if(finishError)throw new Error(`Időjárási szinkronnapló frissítési hiba: ${finishError.message}`);
   return result;
  }

  const stations=await fetchHungaroMetStations();
  const assignments=mappable.map(({field,point})=>{
   const nearest=nearestStation(stations,point.lat,point.lng);
   if(!nearest||nearest.distanceKm>MAX_STATION_DISTANCE_KM)return null;
   return {field,point,...nearest};
  }).filter(Boolean) as Array<{field:any;point:{lat:number;lng:number};station:any;distanceKm:number}>;
  const stationTooFar=mappable.length-assignments.length;

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
  const todayDate=new Date().toISOString().slice(0,10);
  let upserted=0,timelineInserted=0,fieldsSynced=0;
  let unavailableFields=0,emptyMeasurements=0;

  for(const assignment of assignments){
   const dataset=stationData.get(assignment.station.stationNumber);
   if(!dataset){unavailableFields++;continue;}
   const rows=dataset.observations.filter(o=>o.date>=cutoffDate&&o.date<=todayDate&&o.precipitationMm!=null).map(o=>({
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
   if(!rows.length){emptyMeasurements++;continue;}

   const{data:stored,error}=await supabase.from("field_weather_daily")
    .upsert(rows,{onConflict:"field_id,weather_date,provider,station_number"})
    .select("id,field_id,weather_date,precipitation_mm,distance_km,station_name");
   if(error)throw new Error(`Weather upsert hiba (${assignment.field.name}): ${error.message}`);
   if((stored?.length??0)!==rows.length)throw new Error(`Weather upsert hiányos (${assignment.field.name}): ${stored?.length??0}/${rows.length} mérés.`);
   fieldsSynced++;
   upserted+=stored?.length??0;

   const{data:existingEvents,error:lookupError}=await supabase.from("timeline_events")
    .select("id,source_id,title,description").in("source_id",(stored??[]).map(w=>w.id)).eq("event_type","weather_observation");
   if(lookupError)throw new Error(`Weather timeline ellenőrzési hiba: ${lookupError.message}`);
   const{inserts,updates}=planWeatherTimelineChanges(stored??[],existingEvents??[],assignment.field,assignment.station.stationNumber,HUNGAROMET_DAILY_DESCRIPTION_URL);
   for(const update of updates){
    const{error:updateError}=await supabase.from("timeline_events").update({title:update.title,description:update.description}).eq("source_id",update.source_id).eq("event_type","weather_observation");
    if(updateError)throw new Error(`Weather timeline frissítési hiba: ${updateError.message}`);
   }
   if(inserts.length){
    const{error:timelineError}=await supabase.from("timeline_events").insert(inserts);
    if(timelineError)throw new Error(`Weather timeline hiba: ${timelineError.message}`);
    timelineInserted+=inserts.length;
   }
  }

  const skippedFields=totalFields-fieldsSynced;
  const status=weatherSyncStatus(totalFields,fieldsSynced,stationErrors.length);
  const warnings=[
   ...(missingLocation?[{reason:"Nincs használható térképi hely",count:missingLocation}]:[]),
   ...(stationTooFar?[{reason:"Nincs mérőállomás 35 km-en belül",count:stationTooFar}]:[]),
   ...(unavailableFields?[{reason:"Az állomás adatlekérése sikertelen",count:unavailableFields}]:[]),
   ...(emptyMeasurements?[{reason:"Az állomáson nincs friss csapadékmérés",count:emptyMeasurements}]:[])
  ];
  const result={
   ok:true,
   status,
   totalFields,
   fields:fieldsSynced,
   stations:uniqueStations.length,
   stationFailures:stationErrors.length,
   stationErrors,
   warnings,
   observations:upserted,
   timelineInserted,
   skippedFields,
   maxStationDistanceKm:MAX_STATION_DISTANCE_KM,
   lookbackDays:LOOKBACK_DAYS,
   source:"HungaroMet official daily automatic-station observations",
   officialDescriptionUrl:HUNGAROMET_DAILY_DESCRIPTION_URL
  };
  const{error:finishError}=await supabase.from("weather_sync_runs").update({
   finished_at:new Date().toISOString(),
   status,
   fields_total:totalFields,
   fields_synced:fieldsSynced,
   fields_skipped:skippedFields,
   stations_requested:uniqueStations.length,
   stations_failed:stationErrors.length,
   observations_upserted:upserted,
   timeline_inserted:timelineInserted,
   error_summary:[...stationErrors,...warnings],
   metadata:{provider:"HungaroMet",lookback_days:LOOKBACK_DAYS,max_station_distance_km:MAX_STATION_DISTANCE_KM,official_description_url:HUNGAROMET_DAILY_DESCRIPTION_URL}
  }).eq("id",runId);
  if(finishError)throw new Error(`Időjárási szinkronnapló frissítési hiba: ${finishError.message}`);
  return result;
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(runId){
   const{error:logError}=await supabase.from("weather_sync_runs").update({finished_at:new Date().toISOString(),status:"failed",error_summary:[{error:message}]}).eq("id",runId);
   if(logError)console.error("Weather sync run status could not be persisted",logError.message);
  }
  throw error;
 }
}
