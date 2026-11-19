/** Optional OSM field-outline suggestions. These are never cadastral evidence. */
export type OsmFieldSuggestion={
  id:string;
  label:string;
  geometry:{type:"Polygon";coordinates:number[][][]};
  vertices:number;
  approximateHa:number;
};

const allowed=new Set(["farmland","meadow","orchard","vineyard"]);

function asRecord(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}

function onBoundary(x:number,y:number,a:number[],b:number[]){
  const cross=(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  return Math.abs(cross)<1e-11&&x>=Math.min(a[0],b[0])-1e-11&&x<=Math.max(a[0],b[0])+1e-11&&y>=Math.min(a[1],b[1])-1e-11&&y<=Math.max(a[1],b[1])+1e-11;
}

function containsPoint(ring:number[][],lng:number,lat:number){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];
    if(onBoundary(lng,lat,a,b))return true;
    if((a[1]>lat)!==(b[1]>lat)&&lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

function areaHa(ring:number[][]){
  const avgLat=ring.reduce((sum,p)=>sum+p[1],0)/ring.length;
  const metersPerDegree=111_320;
  const lonFactor=Math.cos(avgLat*Math.PI/180);
  let twiceArea=0;
  for(let i=0;i<ring.length-1;i++)twiceArea+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
  return Math.abs(twiceArea)/2*metersPerDegree*metersPerDegree*lonFactor/10_000;
}

export function osmFieldSuggestions(payload:unknown,lat:number,lng:number):OsmFieldSuggestion[]{
  const root=asRecord(payload);
  if(!root||!Array.isArray(root.elements)||!Number.isFinite(lat)||!Number.isFinite(lng))return [];
  const found:OsmFieldSuggestion[]=[];
  for(const item of root.elements.slice(0,300)){
    const element=asRecord(item),tags=asRecord(element?.tags);
    if(!element||element.type!=="way"||typeof element.id!=="number"||!tags||typeof tags.landuse!=="string"||!allowed.has(tags.landuse)||!Array.isArray(element.geometry))continue;
    if(element.geometry.length<4||element.geometry.length>12001)continue;
    const coordinates:number[][]=[];
    let invalid=false;
    for(const raw of element.geometry){
      const point=asRecord(raw),x=point?.lon,y=point?.lat;
      if(typeof x!=="number"||typeof y!=="number"||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>180||Math.abs(y)>90){invalid=true;break}
      coordinates.push([x,y]);
    }
    if(invalid)continue;
    const first=coordinates[0],last=coordinates[coordinates.length-1];
    if(first[0]!==last[0]||first[1]!==last[1]||!containsPoint(coordinates,lng,lat))continue;
    const size=areaHa(coordinates);
    if(!Number.isFinite(size)||size<0.001||size>100_000)continue;
    const kind=({farmland:"Szántó",meadow:"Gyep",orchard:"Ültetvény",vineyard:"Szőlő"} as Record<string,string>)[tags.landuse];
    const name=typeof tags.name==="string"&&tags.name.trim()?` · ${tags.name.trim().slice(0,65)}`:"";
    found.push({id:`osm:way:${element.id}`,label:`${kind}${name}`,geometry:{type:"Polygon",coordinates:[coordinates]},vertices:coordinates.length-1,approximateHa:size});
  }
  return found.sort((a,b)=>a.approximateHa-b.approximateHa).slice(0,5);
}
