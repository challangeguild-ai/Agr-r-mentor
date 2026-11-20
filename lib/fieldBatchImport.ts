import {parseFieldGeometry,type FieldGeometry} from "./fieldGeometry.ts";
import {fieldGeometryFingerprint} from "./fieldGeometryIdentity.ts";

/** Shared client/server preparation. Not an official survey or ownership proof. */
export type IncomingField={name:string;geometry:unknown};
export type PreparedField={name:string;geometry:FieldGeometry;center_lat:number;center_lng:number;area_ha:number};
export type ExistingFieldBoundary={id:string;name:string;geometry?:unknown};

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
  const geometries=new Set<string>();
  for(const row of existing){
    if(!row.geometry)continue;
    try{geometries.add(fieldGeometryFingerprint(parseFieldGeometry(row.geometry).geometry))}catch{/* Legacy invalid boundaries do not hide name conflicts. */}
  }
  return fields.map((field,index)=>{
    if(!field||typeof field.name!=="string")throw new Error(`${index+1}. tábla: hiányzó név.`);
    const name=field.name.trim().replace(/\s+/g," ");
    if(!name||name.length>120)throw new Error(`${index+1}. tábla: 1–120 karakteres név szükséges.`);
    const key=fieldNameKey(name);
    if(names.has(key))throw new Error(`Már létezik ilyen nevű tábla ebben a gazdaságban, vagy kétszer szerepel a fájlban: ${name}`);
    names.add(key);
    const checked=parseFieldGeometry(field.geometry);
    const fingerprint=fieldGeometryFingerprint(checked.geometry);
    if(geometries.has(fingerprint))throw new Error(`Azonos geometriát kétszer importálnál: ${name}`);
    geometries.add(fingerprint);
    const area_ha=estimatedFieldHectares(checked.geometry);
    if(!Number.isFinite(area_ha)||area_ha<=0||area_ha>100000)throw new Error(`${name}: a táblahatárból nem számítható ésszerű terület.`);
    return {name,geometry:checked.geometry,center_lat:checked.stats.centerLat,center_lng:checked.stats.centerLng,area_ha};
  });
}

/** Re-importing a *perfectly identical* existing field is a safe no-op.
 * Same name with changed outline, or same outline under a new name, is not.
 */
export function planFieldBatch(fields:IncomingField[],existing:ExistingFieldBoundary[]):{
  toCreate:PreparedField[];already:{id:string;name:string}[];
}{
  const prepared=prepareFieldBatch(fields);
  const names=new Map<string,ExistingFieldBoundary>();
  const geometries=new Map<string,ExistingFieldBoundary>();
  const fingerprints=new Map<string,string>();
  for(const row of existing){
    names.set(fieldNameKey(row.name),row);
    if(row.geometry){
      try{
        const fingerprint=fieldGeometryFingerprint(parseFieldGeometry(row.geometry).geometry);
        fingerprints.set(row.id,fingerprint);geometries.set(fingerprint,row);
      }catch{/* Existing record may not have a valid boundary. Name checks still apply. */}
    }
  }
  const toCreate:PreparedField[]=[],already:{id:string;name:string}[]=[];
  for(const field of prepared){
    const key=fieldNameKey(field.name),fingerprint=fieldGeometryFingerprint(field.geometry);
    const byName=names.get(key),byGeometry=geometries.get(fingerprint);
    if(byName&&byGeometry&&byName.id===byGeometry.id&&fingerprints.get(byName.id)===fingerprint){
      already.push({id:byName.id,name:field.name});continue;
    }
    if(byName)throw new Error(`A(z) „${field.name}” tábla már létezik, de más a határa. Meglévő táblát importtal nem írunk felül.`);
    if(byGeometry)throw new Error(`A(z) „${field.name}” határa már más néven szerepel a gazdaságban: ${byGeometry.name}.`);
    toCreate.push(field);
  }
  return {toCreate,already};
}
