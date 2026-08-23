export const TASK_PROOF_EVENT="task_completed_verified";

export type TaskProof={
 lat:number;
 lng:number;
 accuracy:number;
 photoPath:string;
 photoName:string;
 capturedAt:string;
 distanceMeters?:number|null;
 validation:"inside_boundary"|"near_boundary"|"near_center";
};

export function encodeTaskProof(proof:TaskProof){return `TASKPROOF:${JSON.stringify(proof)}`}
export function decodeTaskProof(value:string|null|undefined):TaskProof|null{
 if(!value?.startsWith("TASKPROOF:"))return null;
 try{const x=JSON.parse(value.slice(10));if(!x||typeof x!=="object")return null;return x as TaskProof}catch{return null}
}

function toRad(v:number){return v*Math.PI/180}
export function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){
 const r=6371000,dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
 return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function pointInRing(lat:number,lng:number,ring:any[]){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const xi=Number(ring[i]?.[0]),yi=Number(ring[i]?.[1]),xj=Number(ring[j]?.[0]),yj=Number(ring[j]?.[1]);
  if(![xi,yi,xj,yj].every(Number.isFinite))continue;
  const intersect=((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi||1e-12)+xi);
  if(intersect)inside=!inside;
 }
 return inside;
}
export function pointInBoundary(lat:number,lng:number,boundary:any){
 if(!boundary)return false;
 if(boundary.type==="Polygon")return Array.isArray(boundary.coordinates?.[0])&&pointInRing(lat,lng,boundary.coordinates[0]);
 if(boundary.type==="MultiPolygon")return Array.isArray(boundary.coordinates)&&boundary.coordinates.some((p:any)=>Array.isArray(p?.[0])&&pointInRing(lat,lng,p[0]));
 return false;
}

function flattenBoundary(boundary:any):Array<[number,number]>{
 if(boundary?.type==="Polygon")return (boundary.coordinates?.[0]||[]).map((p:any)=>[Number(p?.[1]),Number(p?.[0])] as [number,number]).filter((p:[number,number])=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
 if(boundary?.type==="MultiPolygon")return (boundary.coordinates||[]).flatMap((poly:any)=>(poly?.[0]||[]).map((p:any)=>[Number(p?.[1]),Number(p?.[0])] as [number,number])).filter((p:[number,number])=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
 return [];
}
export function nearestBoundaryDistance(lat:number,lng:number,boundary:any){
 const points=flattenBoundary(boundary);if(!points.length)return null;return Math.min(...points.map(([a,b])=>distanceMeters(lat,lng,a,b)));
}
