import {estimatedFieldHectares} from "./fieldBatchImport.ts";
import {parseFieldGeometry,type FieldGeometry} from "./fieldGeometry.ts";
import {fieldGeometryFingerprint} from "./fieldGeometryIdentity.ts";

export type QualityIssue={
  code:"area_mismatch"|"far_from_existing"|"neighbor_overlap"|"overlap_incomplete"|"point_replaces_polygon";
  severity:"warning"|"info";
  title:string;
  detail:string;
};
export type FieldBoundaryQuality={
  estimatedHa:number|null;
  vertices:number;
  polygonCount:number;
  issues:QualityIssue[];
  overlapChecked:number;
};
export type OtherFieldBoundary={id:string;name:string;boundary:unknown};
export type BoundaryQualityInput={
  geometry:unknown;
  proposedLat?:number|null;
  proposedLng?:number|null;
  oldLat?:number|null;
  oldLng?:number|null;
  oldBoundary?:unknown;
  declaredHa?:number|null;
  neighbors?:OtherFieldBoundary[];
  neighborsTruncated?:boolean;
};

type Point=[number,number];
type Polygon=number[][][];
type Box={minX:number;minY:number;maxX:number;maxY:number};
const TO_RAD=Math.PI/180;
const MAX_SEGMENT_COMPARISONS=120_000;

function haversineKm(a:{lat:number;lng:number},b:{lat:number;lng:number}){
  const dLat=(b.lat-a.lat)*TO_RAD,dLng=(b.lng-a.lng)*TO_RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*TO_RAD)*Math.cos(b.lat*TO_RAD)*Math.sin(dLng/2)**2;
  return 2*6371.0088*Math.asin(Math.min(1,Math.sqrt(h)));
}

function polygons(geometry:FieldGeometry):Polygon[]{
  return geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
}

function box(ring:number[][]):Box{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of ring){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}
  return{minX,minY,maxX,maxY};
}
function boxesShareArea(a:Box,b:Box){return a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY}

function pointOnSegment(p:Point,a:number[],b:number[]){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const cross=(p[0]-a[0])*dy-(p[1]-a[1])*dx;
  if(Math.abs(cross)>1e-11*Math.max(1,Math.abs(dx),Math.abs(dy)))return false;
  return p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12
    &&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;
}

function inRing(point:Point,ring:number[][]):"inside"|"outside"|"border"{
  let inside=false;
  for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1];
    if(pointOnSegment(point,a,b))return"border";
    if((a[1]>point[1])!==(b[1]>point[1])
       &&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?"inside":"outside";
}

/** Strict interior test: shared edges and touching corners are NOT overlaps. */
function insidePolygon(point:Point,poly:Polygon){
  if(inRing(point,poly[0])!=="inside")return false;
  return poly.slice(1).every(hole=>inRing(point,hole)==="outside");
}
function insideGeometry(point:Point,parts:Polygon[]){return parts.some(poly=>insidePolygon(point,poly))}

function orient(a:number[],b:number[],c:number[]){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function properCross(a:number[],b:number[],c:number[],d:number[]){
  const abC=orient(a,b,c),abD=orient(a,b,d),cdA=orient(c,d,a),cdB=orient(c,d,b);
  return (abC>1e-14&&abD< -1e-14||abC< -1e-14&&abD>1e-14)
    &&(cdA>1e-14&&cdB< -1e-14||cdA< -1e-14&&cdB>1e-14);
}

type OverlapVerdict="yes"|"no"|"unknown";
function areaOverlaps(a:FieldGeometry,b:FieldGeometry):OverlapVerdict{
  if(fieldGeometryFingerprint(a)===fieldGeometryFingerprint(b))return"yes";
  const aa=polygons(a),bb=polygons(b);
  let comparisons=0;
  for(const pa of aa)for(const pb of bb){
    if(!boxesShareArea(box(pa[0]),box(pb[0])))continue;
    // A strictly contained vertex or edge midpoint indicates shared area.
    for(const [own,other] of [[pa,[pb]],[pb,[pa]]] as [Polygon,Polygon[]][]){
      for(const ring of own){
        const stride=Math.max(1,Math.ceil((ring.length-1)/64));
        for(let i=0;i<ring.length-1;i+=stride){
          const p=ring[i],q=ring[i+1];
          if(insideGeometry([p[0],p[1]],other)
            ||insideGeometry([(p[0]+q[0])/2,(p[1]+q[1])/2],other))return"yes";
        }
      }
    }
    for(const ringA of pa)for(const ringB of pb){
      for(let i=0;i<ringA.length-1;i++)for(let j=0;j<ringB.length-1;j++){
        if(++comparisons>MAX_SEGMENT_COMPARISONS)return"unknown";
        const a=ringA[i],b=ringA[i+1],c=ringB[j],d=ringB[j+1];
        if(Math.max(a[0],b[0])<=Math.min(c[0],d[0])||Math.max(c[0],d[0])<=Math.min(a[0],b[0])
          ||Math.max(a[1],b[1])<=Math.min(c[1],d[1])||Math.max(c[1],d[1])<=Math.min(a[1],b[1]))continue;
        if(properCross(a,b,c,d))return"yes";
      }
    }
    // Completely coincident outer boundaries but different cut-outs.
    const center:Point=[(box(pa[0]).minX+box(pa[0]).maxX)/2,(box(pa[0]).minY+box(pa[0]).maxY)/2];
    if(insidePolygon(center,pa)&&insidePolygon(center,pb))return"yes";
  }
  return"no";
}

/** Quality hints are *not* official parcel verification or a GPS accuracy score. */
export function assessFieldBoundary(input:BoundaryQualityInput):FieldBoundaryQuality{
  const issues:QualityIssue[]=[];
  if(!input.geometry){
    if(input.oldBoundary)issues.push({code:"point_replaces_polygon",severity:"warning",title:"A meglévő poligon megszűnne",detail:"A csak helypontból álló javaslat elfogadása eltávolítja a jelenleg tárolt táblahatárt."});
    if(input.oldLat!=null&&input.oldLng!=null&&input.proposedLat!=null&&input.proposedLng!=null){
      const distance=haversineKm({lat:input.oldLat,lng:input.oldLng},{lat:input.proposedLat,lng:input.proposedLng});
      if(distance>2)issues.push({code:"far_from_existing",severity:"warning",title:"Az új helypont távol van a korábbitól",detail:`A javasolt helypont kb. ${distance.toLocaleString("hu-HU",{maximumFractionDigits:1})} km-re került a korábbitól. Ellenőrizd a helyszínt.`});
    }
    return{estimatedHa:null,vertices:0,polygonCount:0,issues,overlapChecked:0};
  }
  const checked=parseFieldGeometry(input.geometry);
  const calculated=estimatedFieldHectares(checked.geometry);
  if(input.declaredHa!=null&&Number.isFinite(input.declaredHa)&&input.declaredHa>0&&calculated>0){
    const ratio=calculated/input.declaredHa;
    if(ratio<0.65||ratio>1.4)issues.push({code:"area_mismatch",severity:"warning",title:"Eltérés a nyilvántartott területhez képest",detail:`A poligonból kb. ${calculated.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha számítható, miközben a táblánál ${input.declaredHa.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha szerepel. A művelt terület eltérhet a jogi földrészlettől.`});
  }
  if(input.oldLat!=null&&input.oldLng!=null){
    const distance=haversineKm({lat:input.oldLat,lng:input.oldLng},{lat:checked.stats.centerLat,lng:checked.stats.centerLng});
    const threshold=Math.max(2,Math.sqrt(Math.max(calculated,1))*0.16);
    if(distance>threshold)issues.push({code:"far_from_existing",severity:"warning",title:"A poligon távol van az eddigi helytől",detail:`A javasolt határ közepe körülbelül ${distance.toLocaleString("hu-HU",{maximumFractionDigits:1})} km-re van a korábbi helyponttól. Ellenőrizd, hogy jó táblát választottál-e.`});
  }
  let overlapChecked=0,unknown=false,overlapCount=0;
  for(const neighbor of input.neighbors??[]){
    if(!neighbor.boundary)continue;
    let other:FieldGeometry;
    try{other=parseFieldGeometry(neighbor.boundary).geometry}catch{unknown=true;continue}
    const result=areaOverlaps(checked.geometry,other);
    overlapChecked++;
    if(result==="unknown"){unknown=true;continue}
    if(result==="yes"){
      overlapCount++;
      if(overlapCount<=3)issues.push({code:"neighbor_overlap",severity:"warning",title:`Lehetséges átfedés: ${neighbor.name}`,detail:"A kijelölt terület egy másik nyilvántartott táblával átfedhet. Ellenőrizd a műholdképen; a közös határvonal önmagában nem hiba."});
    }
  }
  if(overlapCount>3)issues.push({code:"neighbor_overlap",severity:"warning",title:`További ${overlapCount-3} lehetséges átfedés`,detail:"A további érintett táblákat is külön ellenőrizni kell."});
  if(unknown||input.neighborsTruncated)issues.push({code:"overlap_incomplete",severity:"info",title:"Az átfedés-ellenőrzés részleges",detail:"Néhány túl részletes, hibás vagy a lekérdezési korláton túli poligont nem tudtunk összevetni. Ettől még nem biztos, hogy nincs átfedés."});
  return{estimatedHa:calculated,vertices:checked.stats.vertices,polygonCount:checked.stats.polygons,issues,overlapChecked};
}
