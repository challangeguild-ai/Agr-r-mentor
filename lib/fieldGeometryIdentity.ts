import type {FieldGeometry} from "./fieldGeometry.ts";

/** Stable identity of a field outline, unaffected by ring start, winding, or part order.
 * This never changes the stored geometry or rounds an actual boundary vertex.
 */
function minimumRotation(values:string[]):string[]{
  const n=values.length;
  const doubled=values.concat(values);
  let left=0,right=1,offset=0;
  while(left<n&&right<n&&offset<n){
    const a=doubled[left+offset],b=doubled[right+offset];
    if(a===b){offset++;continue}
    if(a>b){left+=offset+1;if(left<=right)left=right+1}
    else{right+=offset+1;if(right<=left)right=left+1}
    offset=0;
  }
  const start=Math.min(left,right);
  return values.slice(start).concat(values.slice(0,start));
}

function ringKey(ring:number[][]){
  // Closing vertex is repeated by definition. Z does not change the footprint.
  const vertices=ring.slice(0,-1).map(([lng,lat])=>JSON.stringify([lng,lat]));
  const forward=minimumRotation(vertices).join("|");
  const backward=minimumRotation([...vertices].reverse()).join("|");
  return forward<backward?forward:backward;
}

function polygonKey(polygon:number[][][]){
  const [outer,...holes]=polygon;
  return JSON.stringify([ringKey(outer),...holes.map(ringKey).sort()]);
}

export function fieldGeometryFingerprint(geometry:FieldGeometry){
  const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
  return JSON.stringify(polygons.map(polygonKey).sort());
}
