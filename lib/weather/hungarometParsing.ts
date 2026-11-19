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

const MAX_CSV_BYTES=8*1024*1024;

function normalizeKey(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}

function numberOrNull(value:string|undefined){
 if(value==null)return null;
 const raw=value.trim().replace(",",".");
 if(!raw)return null;
 const n=Number(raw);
 return Number.isFinite(n)&&n!==-999?n:null;
}

function csvLines(text:string){
 return text.replace(/^\uFEFF/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}

function findHeader(lines:string[],required:string[]){
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith("##"))continue;
  // HungaroMet meta sections use #StationNumber;... as their header.
  const raw=line.replace(/^#/,"").split(";").map(x=>x.trim());
  const keys=raw.map(normalizeKey);
  if(required.every(r=>keys.includes(r)))return {index:i,keys};
 }
 return null;
}

function validDate(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const d=new Date(`${date}T12:00:00Z`);
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===date;
}

export function parseHungaroMetStations(text:string):HungaroMetStation[]{
 const lines=csvLines(text);
 const header=findHeader(lines,["stationnumber","latitude","longitude"]);
 if(!header)throw new Error("HungaroMet állomásmeta fejléc nem azonosítható.");
 const idx=(key:string)=>header.keys.indexOf(key);
 const stationIdx=idx("stationnumber"),latIdx=idx("latitude"),lngIdx=idx("longitude");
 const nameIdx=idx("stationname"),elevationIdx=idx("elevation");
 const stations:HungaroMetStation[]=[];
 const seen=new Set<string>();
 for(const line of lines.slice(header.index+1)){
  if(line.startsWith("#"))continue;
  const cols=line.split(";").map(x=>x.trim());
  const latitude=numberOrNull(cols[latIdx]),longitude=numberOrNull(cols[lngIdx]);
  const stationNumber=cols[stationIdx]?.replace(/\D/g,"");
  if(!stationNumber||latitude==null||longitude==null||Math.abs(latitude)>90||Math.abs(longitude)>180||seen.has(stationNumber))continue;
  seen.add(stationNumber);
  stations.push({
   stationNumber,
   name:nameIdx>=0?(cols[nameIdx]||stationNumber):stationNumber,
   latitude,longitude,
   elevation:elevationIdx>=0?numberOrNull(cols[elevationIdx]):null
  });
 }
 if(!stations.length)throw new Error("HungaroMet állomásmeta üres vagy nem feldolgozható.");
 return stations;
}

export function parseHungaroMetDailyCsv(text:string,stationNumber:string):HungaroMetDailyObservation[]{
 const lines=csvLines(text);
 const header=findHeader(lines,["stationnumber","time","rau"]);
 if(!header)throw new Error(`HungaroMet napi CSV fejléc nem azonosítható (${stationNumber}).`);
 const idx=(key:string)=>header.keys.indexOf(key);
 const stationIdx=idx("stationnumber"),timeIdx=idx("time"),rainIdx=idx("rau");
 const tnIdx=idx("tn"),txIdx=idx("tx");
 const observations:HungaroMetDailyObservation[]=[];
 for(const line of lines.slice(header.index+1)){
  if(line.startsWith("#"))continue;
  const cols=line.split(";").map(x=>x.trim());
  const rawDate=cols[timeIdx]||"";
  const date=`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
  if(!/^\d{8}$/.test(rawDate)||!validDate(date))continue;
  const sourceStation=cols[stationIdx]?.replace(/\D/g,"");
  if(sourceStation!==stationNumber)throw new Error(`HungaroMet állomáseltérés: ${stationNumber} helyett ${sourceStation||"ismeretlen"}.`);
  const rain=numberOrNull(cols[rainIdx]);
  observations.push({
   stationNumber,
   date,
   precipitationMm:rain!=null&&rain>=0?rain:null,
   temperatureMinC:tnIdx>=0?numberOrNull(cols[tnIdx]):null,
   temperatureMaxC:txIdx>=0?numberOrNull(cols[txIdx]):null
  });
 }
 return observations;
}

export function unzipOfficialCsv(buffer:ArrayBuffer):string{
 const b=Buffer.from(buffer);
 let eocd=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){
  if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw new Error("HungaroMet ZIP: lezáró rekord nem található.");
 const count=b.readUInt16LE(eocd+10);
 const centralSize=b.readUInt32LE(eocd+12);
 const centralOffset=b.readUInt32LE(eocd+16);
 if(centralOffset+centralSize>eocd)throw new Error("HungaroMet ZIP: hibás központi könyvtár.");
 let position=centralOffset;
 for(let i=0;i<count;i++){
  if(position+46>b.length||b.readUInt32LE(position)!==0x02014b50)throw new Error("HungaroMet ZIP: hibás fájljegyzék.");
  const method=b.readUInt16LE(position+10);
  const compressedSize=b.readUInt32LE(position+20);
  const originalSize=b.readUInt32LE(position+24);
  const nameLen=b.readUInt16LE(position+28),extraLen=b.readUInt16LE(position+30),commentLen=b.readUInt16LE(position+32);
  const localOffset=b.readUInt32LE(position+42);
  const next=position+46+nameLen+extraLen+commentLen;
  if(next>centralOffset+centralSize)throw new Error("HungaroMet ZIP: csonka fájljegyzék.");
  const name=b.subarray(position+46,position+46+nameLen).toString("utf8");
  position=next;
  if(!name.toLowerCase().endsWith(".csv"))continue;
  if(originalSize>MAX_CSV_BYTES||compressedSize>MAX_CSV_BYTES)throw new Error("HungaroMet ZIP: túl nagy CSV fájl.");
  if(localOffset+30>b.length||b.readUInt32LE(localOffset)!==0x04034b50)throw new Error("HungaroMet ZIP: hibás fájlfejléc.");
  const start=localOffset+30+b.readUInt16LE(localOffset+26)+b.readUInt16LE(localOffset+28);
  if(start+compressedSize>b.length)throw new Error("HungaroMet ZIP: csonka CSV adat.");
  const compressed=b.subarray(start,start+compressedSize);
  const out=method===0?compressed:method===8?inflateRawSync(compressed,{maxOutputLength:MAX_CSV_BYTES}):null;
  if(!out)throw new Error(`HungaroMet ZIP: nem támogatott tömörítés (${method}).`);
  if(out.length!==originalSize)throw new Error("HungaroMet ZIP: hibás CSV méret.");
  return out.toString("utf8");
 }
 throw new Error("HungaroMet ZIP: nem található CSV fájl.");
}
