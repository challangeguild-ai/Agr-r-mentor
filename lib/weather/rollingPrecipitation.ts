/** Validate station date keys independently of the Next.js path alias in node:test. */
function validDateOnly(value:string):boolean{
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return false;
 const d=new Date(`${value}T12:00:00Z`);
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}

type RainObservation={
 weather_date:string;
 precipitation_mm:number|string|null;
 fetched_at?:string|null;
 distance_km?:number|null;
};

export function budapestCalendarDate(now:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(now);
 const get=(kind:string)=>parts.find(p=>p.type===kind)?.value||"";
 return `${get("year")}-${get("month")}-${get("day")}`;
}

export function summarizeStationPrecipitation<T extends RainObservation>(rows:readonly T[],now:Date=new Date()){
 const today=budapestCalendarDate(now);
 const todayTime=Date.parse(`${today}T12:00:00Z`);
 const seenDays=new Set<string>();
 let rain7=0,rain30=0,days7=0,days30=0;
 // A table may have multiple station records on one date. Prefer the newest
 // imported observation rather than accidentally counting that day twice.
 const sorted=[...rows].sort((a,b)=>
  String(b.fetched_at||"").localeCompare(String(a.fetched_at||""))
  ||Number(a.distance_km??99999)-Number(b.distance_km??99999));
 for(const row of sorted){
  if(!validDateOnly(row.weather_date)||seenDays.has(row.weather_date))continue;
  if(row.precipitation_mm==null||row.precipitation_mm==="")continue;
  const value=Number(row.precipitation_mm);
  if(!Number.isFinite(value)||value<0)continue;
  const age=Math.round((todayTime-Date.parse(`${row.weather_date}T12:00:00Z`))/86400000);
  if(age<0||age>=30)continue;
  seenDays.add(row.weather_date);
  rain30+=value;days30++;
  if(age<7){rain7+=value;days7++}
 }
 return {rain7,rain30,days7,days30,today};
}
