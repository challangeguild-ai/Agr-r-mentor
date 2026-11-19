/** Exact WGS84 GeoJSON field boundaries; never approximate or simplify vertices. */
export type FieldPolygon = {type:"Polygon";coordinates:number[][][]};
export type FieldMultiPolygon = {type:"MultiPolygon";coordinates:number[][][][]};
export type FieldGeometry = FieldPolygon|FieldMultiPolygon;

export type FieldGeometryStats = {
  polygons:number;
  holes:number;
  vertices:number;
  centerLat:number;
  centerLng:number;
};

const MAX_VERTICES=12000;
const MAX_BYTES=2_000_000;
const MAX_RINGS=150;
const MAX_POLYGONS=60;

function record(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==="object"&&!Array.isArray(value);
}

function checkCrs(root:Record<string,unknown>){
  if(!("crs" in root)||root.crs==null)return;
  const crs=root.crs;
  const name=record(crs)&&record(crs.properties)?crs.properties.name:null;
  if(typeof name!=="string"||!/(?:EPSG:4326|CRS84)$/i.test(name)){
    throw new Error("A fájl vetülete nem WGS84 (EPSG:4326). EOV vagy más vetület esetén előbb alakítsd át WGS84 GeoJSON-ra.");
  }
}

function unwrap(input:unknown):unknown{
  if(!record(input))throw new Error("A GeoJSON-nak objektumnak kell lennie.");
  checkCrs(input);
  if(input.type==="FeatureCollection"){
    if(!Array.isArray(input.features)||input.features.length!==1){
      throw new Error("A FeatureCollection pontosan egy földtáblát tartalmazzon. Több földrészletet előbb egy MultiPolygon geometriába kell rendezni.");
    }
    return unwrap(input.features[0]);
  }
  if(input.type==="Feature")return unwrap(input.geometry);
  return input;
}

function validateRing(input:unknown,stats:{vertices:number;rings:number;minLng:number;maxLng:number;minLat:number;maxLat:number}):number[][]{
  if(!Array.isArray(input)||input.length<4)throw new Error("Minden poligongyűrűnek legalább három töréspontot és egy zárópontot kell tartalmaznia.");
  stats.rings++;
  if(stats.rings>MAX_RINGS)throw new Error("Túl sok különálló határgyűrű szerepel a fájlban.");
  stats.vertices+=input.length-1;
  if(stats.vertices>MAX_VERTICES)throw new Error(`Túl sok töréspont (maximum ${MAX_VERTICES}). A pontok automatikus egyszerűsítése nem megengedett.`);
  const ring=input.map((p:unknown)=>{
    if(!Array.isArray(p)||p.length<2||p.length>3||!p.every(v=>typeof v==="number"&&Number.isFinite(v))){
      throw new Error("Hibás koordináta: [hosszúság, szélesség] számpárok szükségesek.");
    }
    const [lng,lat]=p as number[];
    if(lng< -180||lng>180||lat< -90||lat>90)throw new Error("A koordináták nincsenek WGS84 fokban. Ellenőrizd a forrás vetületét.");
    stats.minLng=Math.min(stats.minLng,lng);stats.maxLng=Math.max(stats.maxLng,lng);
    stats.minLat=Math.min(stats.minLat,lat);stats.maxLat=Math.max(stats.maxLat,lat);
    return p as number[];
  });
  const first=ring[0],last=ring[ring.length-1];
  if(first[0]!==last[0]||first[1]!==last[1])throw new Error("A poligongyűrű nincs lezárva: az első és utolsó koordinátának egyeznie kell.");
  let doubledArea=0;
  for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1];
    if(a[0]===b[0]&&a[1]===b[1])throw new Error("Azonos szomszédos töréspontok vannak a poligonban.");
    doubledArea+=(a[0]-first[0])*(b[1]-first[1])-(b[0]-first[0])*(a[1]-first[1]);
  }
  if(Math.abs(doubledArea)<1e-15)throw new Error("A poligongyűrű területe nulla vagy túl kicsi.");
  return ring;
}

function validatePolygon(input:unknown,stats:{vertices:number;rings:number;minLng:number;maxLng:number;minLat:number;maxLat:number}):number[][][]{
  if(!Array.isArray(input)||input.length===0)throw new Error("A poligon külső határgyűrűje hiányzik.");
  return input.map(ring=>validateRing(ring,stats));
}

export function parseFieldGeometry(input:unknown):{geometry:FieldGeometry;stats:FieldGeometryStats}{
  const root=unwrap(input);
  if(!record(root)||!Array.isArray(root.coordinates)||!(root.type==="Polygon"||root.type==="MultiPolygon")){
    throw new Error("Csak Polygon vagy MultiPolygon alakú földtáblahatár importálható.");
  }
  const stats={vertices:0,rings:0,minLng:Infinity,maxLng:-Infinity,minLat:Infinity,maxLat:-Infinity};
  const polygons=root.type==="Polygon"?[root.coordinates]:root.coordinates;
  if(polygons.length===0||polygons.length>MAX_POLYGONS)throw new Error("A fájl nem tartalmaz megfelelő számú poligont.");
  const validated=polygons.map(p=>validatePolygon(p,stats));
  const geometry:FieldGeometry=root.type==="Polygon"
    ?{type:"Polygon",coordinates:validated[0]}
    :{type:"MultiPolygon",coordinates:validated};
  return {geometry,stats:{polygons:validated.length,holes:stats.rings-validated.length,vertices:stats.vertices,centerLng:(stats.minLng+stats.maxLng)/2,centerLat:(stats.minLat+stats.maxLat)/2}};
}

export function parseFieldGeometryText(text:string){
  if(text.length>MAX_BYTES)throw new Error("A GeoJSON fájl túl nagy (legfeljebb 2 MB lehet).");
  let value:unknown;
  try{value=JSON.parse(text)}catch{throw new Error("A fájl nem érvényes JSON.");}
  return parseFieldGeometry(value);
}
