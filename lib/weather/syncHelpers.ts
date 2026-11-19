export type FieldWeatherLocation={
 center_lat:number|null;
 center_lng:number|null;
 boundary_geojson:unknown;
};

function validPosition(lat:number,lng:number){
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
}

export function fieldPoint(field:FieldWeatherLocation):{lat:number;lng:number}|null{
 if(field.center_lat!=null&&field.center_lng!=null){
  const lat=Number(field.center_lat),lng=Number(field.center_lng);
  if(validPosition(lat,lng)&&!(lat===0&&lng===0))return {lat,lng};
 }
 const raw=field.boundary_geojson as any;
 const geometry=raw?.type==="Feature"?raw.geometry:raw;
 const rings=geometry?.type==="Polygon"?[geometry.coordinates?.[0]]:
  geometry?.type==="MultiPolygon"?geometry.coordinates?.map((part:any)=>part?.[0]):[];
 if(!Array.isArray(rings))return null;
 let totalArea=0,weightedLat=0,weightedLng=0;
 let fallbackLat=0,fallbackLng=0,fallbackCount=0;
 for(const ring of rings){
  if(!Array.isArray(ring))continue;
  const points=ring.filter((p:any)=>Array.isArray(p)&&validPosition(Number(p[1]),Number(p[0])))
   .map((p:any)=>({lng:Number(p[0]),lat:Number(p[1])}));
  if(points.length>1&&points[0].lat===points[points.length-1].lat&&points[0].lng===points[points.length-1].lng)points.pop();
  if(points.length<3)continue;
  for(const p of points){fallbackLat+=p.lat;fallbackLng+=p.lng;fallbackCount++}
  let doubleArea=0,centroidLng=0,centroidLat=0;
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   const cross=a.lng*b.lat-b.lng*a.lat;
   doubleArea+=cross;
   centroidLng+=(a.lng+b.lng)*cross;
   centroidLat+=(a.lat+b.lat)*cross;
  }
  if(Math.abs(doubleArea)<1e-12)continue;
  const area=Math.abs(doubleArea)/2;
  weightedLng+=area*centroidLng/(3*doubleArea);
  weightedLat+=area*centroidLat/(3*doubleArea);
  totalArea+=area;
 }
 if(totalArea>0)return {lat:weightedLat/totalArea,lng:weightedLng/totalArea};
 return fallbackCount?{lat:fallbackLat/fallbackCount,lng:fallbackLng/fallbackCount}:null;
}

export async function fetchAllWeatherFields<T>(fetchPage:(from:number,to:number)=>Promise<{data:T[]|null;error:{message:string}|null}>,pageSize=500):Promise<T[]>{
 const fields:T[]=[];
 for(let from=0;;from+=pageSize){
  const {data,error}=await fetchPage(from,from+pageSize-1);
  if(error)throw new Error(`Földtáblák lekérdezési hiba: ${error.message}`);
  const page=data??[];
  fields.push(...page);
  if(page.length<pageSize)return fields;
 }
}

export function weatherSyncStatus(totalFields:number,syncedFields:number,stationFailures:number):"success"|"partial"{
 return stationFailures===0&&syncedFields===totalFields?"success":"partial";
}

type StoredWeather={
 id:string;
 weather_date:string;
 precipitation_mm:number|string;
 distance_km:number|string|null;
 station_name:string|null;
};
type ExistingWeatherEvent={source_id:string|null;title:string;description:string|null};

export function planWeatherTimelineChanges(
 observations:readonly StoredWeather[],existingEvents:readonly ExistingWeatherEvent[],
 field:{id:string;farm_id:string},stationNumber:string,officialDescriptionUrl:string
){
 const existingBySource=new Map(existingEvents.map(e=>[e.source_id,e]));
 const inserts=[];
 const updates:Array<{source_id:string;title:string;description:string}>=[];
 for(const weather of observations){
  const existing=existingBySource.get(weather.id);
  const rainValue=Number(weather.precipitation_mm);
  if(!Number.isFinite(rainValue)||rainValue<0)throw new Error("Érvénytelen napi csapadékmérés a szinkronban.");
  if(rainValue===0&&!existing)continue;
  const rain=rainValue.toLocaleString("hu-HU",{maximumFractionDigits:2});
  const distance=weather.distance_km==null?"távolság ismeretlen":`${Number(weather.distance_km).toLocaleString("hu-HU",{maximumFractionDigits:1})} km a táblától`;
  const description=`${rain} mm mért napi csapadék · HungaroMet ${weather.station_name||stationNumber} állomás · ${distance} · mérési időszak: 06–06 UTC`;
  const title=rainValue>0?`Csapadék: ${rain} mm`:`Csapadék helyesbítve: ${rain} mm`;
  if(existing){
   if(existing.title!==title||existing.description!==description)updates.push({source_id:weather.id,title,description});
   continue;
  }
  inserts.push({
   farm_id:field.farm_id,
   field_id:field.id,
   event_type:"weather_observation",
   title,description,
   event_at:`${weather.weather_date}T12:00:00Z`,
   source_id:weather.id,
   technical_payload:{
    provider:"HungaroMet",source_type:"measured",station_number:stationNumber,
    distance_km:weather.distance_km,measurement_period:"06_utc_to_next_06_utc",
    official_description_url:officialDescriptionUrl
   }
  });
 }
 return {inserts,updates};
}
