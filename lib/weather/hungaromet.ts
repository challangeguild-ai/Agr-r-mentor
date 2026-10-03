import "server-only";
import {inflateRawSync} from "node:zlib";

export type HungaroMetStation={
 stationNumber:string;
 name:string;
 latitude:number;
 longitude:number;
 elevation?:number|null;
};

export type HungaroMetDailyObservation={
 stationNumber:string;
 date:string;
 precipitationMm:number|null;
 temperatureMinC:number|null;
 temperatureMaxC:number|null;
};

const META_URL="https://odp.met.hu/climate/observations_hungary/meta/station_meta_auto.csv";
const DAILY_BASE="https://odp.met.hu/climate/observations_hungary/daily/recent";

function normalizeKey(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}
function numberOrNull(value:string|undefined){
 if(value==null)return null;
 const n=Number(value.replace(",","."));
 return Number.isFinite(n)&&n!==-999?n:null;
}
function parseSemicolon(text:string){
 return text.replace(/^\uFEFF/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}
function findHeader(lines:string[],required:string[]){
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith("#"))continue;
  const cols=line.split(";").map(normalizeKey);
  if(required.every(r=>cols.includes(r)))return {index:i,raw:line.split(";").map(x=>x.trim()),keys:cols};
 }
 return null;
}

export function unzipSingleText(buffer:ArrayBuffer){
 const b=Buffer.from(buffer);
 let eocd=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw new Error("HungaroMet ZIP: EOCD nem található.");
 const centralOffset=b.readUInt32LE(eocd+16);
 if(b.readUInt32LE(centralOffset)!==0x02014b50)throw new Error("HungaroMet ZIP: központi könyvtár nem található.");
 const method=b.readUInt16LE(centralOffset+10);
 const compressedSize=b.readUInt32LE(centralOffset+20);
 const localOffset=b.readUInt32LE(centralOffset+42);
 if(b.readUInt32LE(localOffset)!==0x04034b50)throw new Error("HungaroMet ZIP: lokális fejléc nem található.");
 const fileNameLength=b.readUInt16LE(localOffset+26);
 const extraLength=b.readUInt16LE(localOffset+28);
 const start=localOffset+30+fileNameLength+extraLength;
 const compressed=b.subarray(start,start+compressedSize);
 const out=method===0?compressed:method===8?inflateRawSync(compressed):null;
 if(!out)throw new Error(`HungaroMet ZIP: nem támogatott tömörítés (${method}).`);
 return out.toString("utf8");
}

export async function fetchHungaroMetStations(){
 const res=await fetch(META_URL,{cache:"no-store",headers:{"user-agent":"Agrar-Mentor/2.1"}});
 if(!res.ok)throw new Error(`HungaroMet állomásmeta nem elérhető: ${res.status}`);
 const lines=parseSemicolon(await res.text());
 const header=findHeader(lines,["stationnumber","latitude","longitude"]);
 if(!header)throw new Error("HungaroMet állomásmeta fejléc nem azonosítható.");
 const idx=(name:string)=>header.keys.indexOf(name);
 const stationIdx=idx("stationnumber"),latIdx=idx("latitude"),lngIdx=idx("longitude");
 const nameIdx=idx("stationname"),elevationIdx=idx("elevation");
 const stations:HungaroMetStation[]=[];
 for(const line of lines.slice(header.index+1)){
  if(line.startsWith("#"))continue;
  const cols=line.split(";").map(x=>x.trim());
  const latitude=numberOrNull(cols[latIdx]),longitude=numberOrNull(cols[lngIdx]);
  const stationNumber=cols[stationIdx]?.replace(/\D/g,"");
  if(!stationNumber||latitude==null||longitude==null)continue;
  stations.push({stationNumber,name:nameIdx>=0?(cols[nameIdx]||stationNumber):stationNumber,latitude,longitude,elevation:elevationIdx>=0?numberOrNull(cols[elevationIdx]):null});
 }
 return stations;
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
 const sourceUrl=`${DAILY_BASE}/HABP_1D_${stationNumber}_akt.zip`;
 const res=await fetch(sourceUrl,{cache:"no-store",headers:{"user-agent":"Agrar-Mentor/2.1"}});
 if(!res.ok)throw new Error(`HungaroMet napi adat nem elérhető (${stationNumber}): ${res.status}`);
 const text=unzipSingleText(await res.arrayBuffer());
 const lines=parseSemicolon(text);
 const header=findHeader(lines,["stationnumber","time","rau"]);
 if(!header)throw new Error(`HungaroMet napi CSV fejléc nem azonosítható (${stationNumber}).`);
 const stationIdx=header.keys.indexOf("stationnumber"),timeIdx=header.keys.indexOf("time"),rainIdx=header.keys.indexOf("rau"),tnIdx=header.keys.indexOf("tn"),txIdx=header.keys.indexOf("tx");
 const observations:HungaroMetDailyObservation[]=[];
 for(const line of lines.slice(header.index+1)){
  if(line.startsWith("#"))continue;
  const cols=line.split(";").map(x=>x.trim());
  const rawDate=cols[timeIdx]||"";
  if(!/^\d{8}$/.test(rawDate))continue;
  observations.push({
   stationNumber:cols[stationIdx]||stationNumber,
   date:`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`,
   precipitationMm:numberOrNull(cols[rainIdx]),
   temperatureMinC:tnIdx>=0?numberOrNull(cols[tnIdx]):null,
   temperatureMaxC:txIdx>=0?numberOrNull(cols[txIdx]):null
  });
 }
 return {sourceUrl,sourceFile:`HABP_1D_${stationNumber}_akt.zip`,observations};
}
