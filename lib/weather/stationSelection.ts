import type {HungaroMetStation,HungaroMetDailyObservation} from "./hungarometParsing";

export function stationDistanceKm(lat1:number,lng1:number,lat2:number,lng2:number){
 const r=6371,toRad=(x:number)=>x*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
 return 2*r*Math.asin(Math.min(1,Math.sqrt(a)));
}

/** Only nearby stations are candidates. A backup is never chosen outside the configured radius. */
export function nearbyStations(stations:readonly HungaroMetStation[],lat:number,lng:number,maxKm:number,limit=2){
 return stations.map(station=>({station,distanceKm:stationDistanceKm(lat,lng,station.latitude,station.longitude)}))
  .filter(candidate=>Number.isFinite(candidate.distanceKm)&&candidate.distanceKm<=maxKm)
  .sort((a,b)=>a.distanceKm-b.distanceKm||a.station.stationNumber.localeCompare(b.station.stationNumber))
  .slice(0,limit);
}

/** Missing (-999), future and out-of-window observations never count as a fresh measurement. */
export function latestMeasuredDate(observations:readonly HungaroMetDailyObservation[],fromDate:string,toDate:string){
 let latest:string|null=null;
 for(const observation of observations){
  if(observation.precipitationMm==null||observation.precipitationMm<0)continue;
  if(observation.date<fromDate||observation.date>toDate)continue;
  if(latest==null||observation.date>latest)latest=observation.date;
 }
 return latest;
}
