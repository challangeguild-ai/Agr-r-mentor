export const TASK_PROOF_EVENT="task_completed_verified";
export const MAX_TASK_GPS_AGE_MS=15*60*1000;
const MAX_TASK_GPS_FUTURE_SKEW_MS=2*60*1000;

/** A GPS fix must be recent relative to submission, not merely uploaded recently. */
export function gpsFixFreshEnough(capturedAtMs:number,nowMs:number):boolean{
 if(!Number.isFinite(capturedAtMs)||capturedAtMs<=0||!Number.isFinite(nowMs)||nowMs<=0)return false;
 const ageMs=nowMs-capturedAtMs;
 return ageMs<=MAX_TASK_GPS_AGE_MS&&ageMs>=-MAX_TASK_GPS_FUTURE_SKEW_MS;
}

/** Only a confirmed pre-write rejection permits deleting uploaded evidence. */
export function confirmedSafeToDeleteProof(result:{ok:boolean;safeToRemoveProof?:boolean}|null|undefined):boolean{
 return result?.ok===false&&result.safeToRemoveProof===true;
}

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

export type SubmittedProofOutcome="stored_this_photo"|"stored_other_photo"|"unconfirmed";

/** Only a persisted task report can prove an uploaded photo is redundant. */
export function submittedProofOutcome(status:string|null|undefined,proofText:string|null|undefined,uploadedPath:string):SubmittedProofOutcome{
 if(status!=="submitted"&&status!=="done")return "unconfirmed";
 const storedPath=decodeTaskProof(proofText)?.photoPath;
 if(typeof storedPath!=="string"||!storedPath||!uploadedPath)return "unconfirmed";
 return storedPath===uploadedPath?"stored_this_photo":"stored_other_photo";
}

function toRad(v:number){return v*Math.PI/180}
export function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){
 const r=6371000,dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
 return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function pointInRing(lat:number,lng:number,ring:any[]){
 if(!Array.isArray(ring)||ring.length<3)return false;
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const xi=Number(ring[i]?.[0]),yi=Number(ring[i]?.[1]),xj=Number(ring[j]?.[0]),yj=Number(ring[j]?.[1]);
  if(![xi,yi,xj,yj].every(Number.isFinite))continue;
  const intersect=((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi||1e-12)+xi);
  if(intersect)inside=!inside;
 }
 return inside;
}

/** GeoJSON Polygon is a list of rings; the first is exterior, the rest are holes. */
function polygonRings(boundary:any):any[][][]{
 if(boundary?.type==="Polygon"&&Array.isArray(boundary.coordinates))
  return [boundary.coordinates];
 if(boundary?.type==="MultiPolygon"&&Array.isArray(boundary.coordinates))
  return boundary.coordinates;
 return [];
}
export function pointInBoundary(lat:number,lng:number,boundary:any){
 return polygonRings(boundary).some(rings=>
  Array.isArray(rings?.[0])&&pointInRing(lat,lng,rings[0])&&
  !rings.slice(1).some(hole=>pointInRing(lat,lng,hole)));
}
/** A hole is excluded farmland even when its edge is within GPS tolerance. */
export function pointInBoundaryHole(lat:number,lng:number,boundary:any){
 return polygonRings(boundary).some(rings=>
  Array.isArray(rings?.[0])&&pointInRing(lat,lng,rings[0])&&
  rings.slice(1).some(hole=>pointInRing(lat,lng,hole)));
}

/** Local tangent plane: accurate for the short field-boundary distances we accept. */
function distanceToSegmentMeters(lat:number,lng:number,aLat:number,aLng:number,bLat:number,bLng:number){
 const rad=Math.PI/180,earthRadius=6371000;
 const scaleX=rad*earthRadius*Math.cos(((lat+aLat+bLat)/3)*rad);
 const scaleY=rad*earthRadius;
 const ax=(aLng-lng)*scaleX,ay=(aLat-lat)*scaleY;
 const bx=(bLng-lng)*scaleX,by=(bLat-lat)*scaleY;
 const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
 const t=lengthSquared>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/lengthSquared)):0;
 return Math.hypot(ax+t*dx,ay+t*dy);
}
/**
 * Distance to the nearest exterior edge, not just its vertices. Interior hole
 * rings are intentionally excluded: they are not a valid GPS override zone.
 */
export function nearestBoundaryDistance(lat:number,lng:number,boundary:any){
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
 let nearest=Infinity;
 for(const rings of polygonRings(boundary)){
  const exterior=rings?.[0];
  if(!Array.isArray(exterior)||exterior.length<3)continue;
  for(let i=0;i<exterior.length;i++){
   const a=exterior[i],b=exterior[(i+1)%exterior.length];
   const aLat=Number(a?.[1]),aLng=Number(a?.[0]),bLat=Number(b?.[1]),bLng=Number(b?.[0]);
   if(![aLat,aLng,bLat,bLng].every(Number.isFinite))continue;
   nearest=Math.min(nearest,distanceToSegmentMeters(lat,lng,aLat,aLng,bLat,bLng));
  }
 }
 return Number.isFinite(nearest)?nearest:null;
}
