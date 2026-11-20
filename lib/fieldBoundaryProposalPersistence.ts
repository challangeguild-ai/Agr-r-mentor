type Candidate={
  centerLat:number|null;
  centerLng:number|null;
  geometry:{type:string;coordinates:unknown}|null;
  source:string;
  note:string;
};

type PendingProposal={
  center_lat:number|null;
  center_lng:number|null;
  boundary_geojson:{type:string;coordinates:unknown}|null;
  geometry_source:string;
  note:string;
};

/** A timed-out submit may already have committed. Recover only that exact proposal. */
export function matchesPendingBoundaryProposal(row:PendingProposal|null,candidate:Candidate):boolean{
  if(!row||row.geometry_source!==candidate.source||row.note!==candidate.note)return false;
  if(candidate.geometry){
    return !!row.boundary_geojson
      && row.boundary_geojson.type===candidate.geometry.type
      && JSON.stringify(row.boundary_geojson.coordinates)===JSON.stringify(candidate.geometry.coordinates);
  }
  return !row.boundary_geojson
    && row.center_lat===candidate.centerLat
    && row.center_lng===candidate.centerLng;
}
