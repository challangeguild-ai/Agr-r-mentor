import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {matchesPendingBoundaryProposal} from "../lib/fieldBoundaryProposalPersistence.ts";

const geo={type:"Polygon",coordinates:[[[19,47],[20,47],[20,48],[19,47]]]};
const candidate={centerLat:47.5,centerLng:19.5,geometry:geo,source:"external",note:"Ellenőrizve"};
const pending={center_lat:47.3,center_lng:19.3,boundary_geojson:{coordinates:geo.coordinates,type:geo.type},geometry_source:"external",note:"Ellenőrizve"};

test("a committed polygon proposal can be recovered even if PostGIS corrected its outside center",()=>{
 assert.equal(matchesPendingBoundaryProposal(pending,candidate),true);
});

test("a different geometry, note, or source cannot be misreported as this user's successful submission",()=>{
 assert.equal(matchesPendingBoundaryProposal(null,candidate),false);
 assert.equal(matchesPendingBoundaryProposal({...pending,note:"Másik változat"},candidate),false);
 assert.equal(matchesPendingBoundaryProposal({...pending,geometry_source:"manual"},candidate),false);
 assert.equal(matchesPendingBoundaryProposal({...pending,boundary_geojson:{type:"Polygon",coordinates:[[[19,47],[21,47],[20,48],[19,47]]]}},candidate),false);
});

test("point-only submissions require the same exact coordinates",()=>{
 const point={centerLat:47.1,centerLng:19.1,geometry:null,source:"manual",note:""};
 const row={center_lat:47.1,center_lng:19.1,boundary_geojson:null,geometry_source:"manual",note:""};
 assert.equal(matchesPendingBoundaryProposal(row,point),true);
 assert.equal(matchesPendingBoundaryProposal({...row,center_lng:19.2},point),false);
 assert.equal(matchesPendingBoundaryProposal({...row,boundary_geojson:geo},point),false);
});

test("reviewers recover a lost RPC response only for their own identical persisted decision",()=>{
 const action=readFileSync(new URL("../app/admin/map/proposals/actions.ts",import.meta.url),"utf8");
 assert.match(action,/reviewed\?\.reviewed_by===user\.id/);
 assert.match(action,/reviewed\.status===\(decision==="approve"\?"approved":"rejected"\)/);
 assert.match(action,/String\(reviewed\.review_note\|\|""\)\.trim\(\)===note/);
 assert.match(action,/try\{revalidatePath\(path\)\}catch\(error\)/);
});

test("submitting a proposal read-backs only the same caller's pending row after a timeout",()=>{
 const action=readFileSync(new URL("../app/fields/[id]/proposal-actions.ts",import.meta.url),"utf8");
 assert.match(action,/\.eq\("field_id",fieldId\)\.eq\("proposed_by",user\.id\)\.eq\("status","pending"\)/);
 assert.match(action,/matchesPendingBoundaryProposal\(pending,\{centerLat:lat,centerLng:lng,geometry,source,note\}\)/);
 assert.match(action,/A korábban elmentett javaslatot megtaláltuk/);
 assert.match(action,/try\{revalidatePath\(path\)\}catch\(error\)/);
});

test("advisor review stores status feedback for proposer and owner exactly once",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261119123000_field_boundary_proposals.sql",import.meta.url),"utf8");
 assert.match(sql,/gis\.ST_PointOnSurface\(v_geom\)/);
 assert.match(sql,/gis\.ST_Covers\(v_geom,/);
 assert.match(sql,/v_center_lat,v_center_lng,p_boundary_geojson/);
 assert.match(sql,/insert into public\.notifications\(user_id,kind,title,message,href,event_key\)/g);
 assert.match(sql,/select v_proposal\.proposed_by as recipient_id[\s\S]*?select f\.owner_id/);
 assert.match(sql,/'boundary:'\|\|v_proposal\.id::text\|\|':review:'/);
 assert.match(sql,/on conflict \(user_id,event_key\) where event_key is not null do nothing/);
});
