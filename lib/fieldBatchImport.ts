import {parseFieldGeometry,type FieldGeometry} from "./fieldGeometry.ts";

/** Shared client/server preparation. Not an official survey or ownership proof. */
export type IncomingField={name:string;geometry:unknown};
export type PreparedField={name:string;geometry:FieldGeometry;center_lat:number;center_lng:number;area_ha:number};

export const MAX_BULK_FIELDS=50;
export const MAX_BULK_PAYLOAD_BYTES=850_000;
const EARTH_RADIUS=6378137;
const TO_RAD=Math.PI/180;

export function fieldNameKey(name:string){
  return name.normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("hu-HU");
}

function ringArea(ring:number[][]){
  let area=0;
  for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1];
    const dLng=(b[0]-a[0])*TO_RAD;
    area+=dLng*(2+Math.sin(a[1]*TO_RAD)+Math.sin(b[1]*TO_RAD));
  }
  return Math.abs(area*EARTH_RADIUS*EARTH_RADIUS/2);
}

export function estimatedFieldHectares(geometry:FieldGeometry){
  const polys=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
  const area=polys.reduce((sum,rings)=>sum+Math.max(0,ringArea(rings[0])-rings.slice(1).reduce((holes,ring)=>holes+ringArea(ring),0)),0);
  return Math.round(area/10_000*10_000)/10_000;
}

export function prepareFieldBatch(fields:IncomingField[],existing:{name:string;geometry?:unknown}[]=[]):PreparedField[]{
  if(!Array.isArray(fields)||fields.length===0||fields.length>MAX_BULK_FIELDS){
    throw new Error(`Egyszerre 1–${MAX_BULK_FIELDS} földtábla importálható.`);
  }
  let raw="";
  try{raw=JSON.stringify(fields)}catch{throw new Error("A feltöltött adatok nem alakíthatók át földtáblákká.")}
  if(raw.length>MAX_BULK_PAYLOAD_BYTES)throw new Error("A kiválasztott táblák túl sok koordinátát tartalmaznak. Kevesebbet válassz egyszerre.");
  const names=new Set(existing.map(row=>fieldNameKey(row.name)));
  const geometries=new Set(existing.filter(row=>row.geometry).map(row=>JSON.stringify(row.geometry)));
  return fields.map((field,index)=>{
    if(!field||typeof field.name!=="string")throw new Error(`${index+1}. tábla: hiányzó név.`);
    const name=field.name.trim().replace(/\s+/g," ");
    if(!name||name.length>120)throw new Error(`${index+1}. tábla: 1–120 karakteres név szükséges.`);
    const key=fieldNameKey(name);
    if(names.has(key))throw new Error(`Már létezik ilyen nevű tábla ebben a gazdaságban, vagy kétszer szerepel a fájlban: ${name}`);
    names.add(key);
    const checked=parseFieldGeometry(field.geometry);
    const fingerprint=JSON.stringify(checked.geometry);
    if(geometries.has(fingerprint))throw new Error(`Azonos geometriát kétszer importálnál: ${name}`);
    geometries.add(fingerprint);
    const area_ha=estimatedFieldHectares(checked.geometry);
    if(!Number.isFinite(area_ha)||area_ha<=0||area_ha>100000)throw new Error(`${name}: a táblahatárból nem számítható ésszerű terület.`);
    return {name,geometry:checked.geometry,center_lat:checked.stats.centerLat,center_lng:checked.stats.centerLng,area_ha};
  });
}
