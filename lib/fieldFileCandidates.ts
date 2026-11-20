/** Turn user-owned GeoJSON and parsed Shapefile layers into selectable field outlines.
 * Never guess which of several polygons is the intended agricultural field.
 */
export type FieldFileCandidate={
  id:string;
  label:string;
  geometry:unknown;
};

function record(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}

function labelFor(feature:Record<string,unknown>,fallback:string){
  const properties=record(feature.properties);
  for(const key of ["HRSZ","hrsz","parcel_number","PARCEL","name","Name","NAME","id"]){
    const candidate=properties?.[key];
    if(typeof candidate==="string"||typeof candidate==="number"){
      const s=String(candidate).trim();
      if(s)return s.slice(0,90);
    }
  }
  return fallback;
}

export function fieldFileCandidates(payload:unknown,max=60):FieldFileCandidate[]{
  const results:FieldFileCandidate[]=[];
  let visited=0;
  function walk(value:unknown,layer:string){
    if(Array.isArray(value)){
      for(const part of value)walk(part,layer);
      return;
    }
    const obj=record(value);
    if(!obj)return;
    if(obj.crs!=null){
      const crs=record(obj.crs),props=record(crs?.properties);
      const name=props?.name;
      if(typeof name!=="string"||!/(?:EPSG:4326|CRS84)$/i.test(name)){
        throw new Error("A GeoJSON vetülete nem WGS84 (EPSG:4326). A feltöltés előtt alakítsd át WGS84 formátumba.");
      }
    }
    if(obj.type==="FeatureCollection"){
      if(!Array.isArray(obj.features))throw new Error("A térképi állomány hibás FeatureCollection adatait nem lehet értelmezni.");
      for(const item of obj.features)walk(item,typeof obj.fileName==="string"?obj.fileName:layer);
      return;
    }
    if(obj.type==="Feature"){
      const geometry=record(obj.geometry);
      if(!geometry||!(geometry.type==="Polygon"||geometry.type==="MultiPolygon"))return;
      visited++;
      if(visited>max)throw new Error(`A fájl több mint ${max} külön területet tartalmaz. Exportálj kisebb területről adatokat.`);
      results.push({id:`file:${visited}`,label:labelFor(obj,`${layer?`${layer} · `:""}${visited}. poligon`),geometry});
      return;
    }
    if(obj.type==="Polygon"||obj.type==="MultiPolygon"){
      visited++;
      if(visited>max)throw new Error(`A fájl több mint ${max} külön területet tartalmaz. Exportálj kisebb területről adatokat.`);
      results.push({id:`file:${visited}`,label:`${layer?`${layer} · `:""}${visited}. poligon`,geometry:obj});
    }
  }
  walk(payload,"");
  if(!results.length)throw new Error("A fájl nem tartalmaz felhasználható Polygon vagy MultiPolygon táblahatárt.");
  return results;
}
