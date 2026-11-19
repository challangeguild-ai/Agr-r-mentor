import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=file("../supabase/migrations/20261119123000_field_boundary_proposals.sql");
const submission=file("../app/fields/[id]/proposal-actions.ts");
const review=file("../app/admin/map/proposals/actions.ts");
const editor=file("../components/FieldMapEditor.tsx");
const farmer=file("../components/FieldBoundaryProposalLauncher.tsx");
const advisor=file("../app/admin/map/proposals/[id]/page.tsx");
const comparison=file("../components/FieldBoundaryComparisonMap.tsx");

test("farmers may not insert into or update the authoritative fields table from the proposal action",()=>{
  assert.match(submission,/submit_field_boundary_proposal/);
  assert.doesNotMatch(submission,/\.from\("fields"\)\.update/);
  assert.match(sql,/revoke all on public\.field_boundary_proposals from public,anon,authenticated/);
  assert.match(sql,/grant select on public\.field_boundary_proposals to authenticated/);
  assert.match(sql,/create policy "boundary proposals visible to authorized participants"/);
  assert.equal((sql.match(/security definer set search_path=''/g)||[]).length,2);
});

test("proposer, farm and baseline are derived from trusted database rows",()=>{
  assert.match(sql,/v_user uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql,/select \* into v_field from public\.fields where id=p_field_id for share/);
  assert.match(sql,/public\.can_coordinate_farm\(v_field\.farm_id\)/);
  assert.match(sql,/p_field_id,v_field\.farm_id,v_user/);
  assert.match(sql,/v_field\.boundary_updated_at/);
});

test("only one pending proposal per field is allowed",()=>{
  assert.match(sql,/unique index field_boundary_proposals_one_pending_field[\s\S]*?where status='pending'/);
  assert.match(sql,/if exists\(select 1 from public\.field_boundary_proposals where field_id=p_field_id and status='pending'\)/);
  assert.match(submission,/submitError\.code==="23505"/);
  assert.match(farmer,/pending\?\<p role="status"/);
});

test("proposal geometry is validated server-side, not trusted from the client",()=>{
  assert.match(submission,/parseFieldGeometryText\(boundaryText\)/);
  assert.match(sql,/gis\.ST_GeomFromGeoJSON\(p_boundary_geojson::text\)/);
  assert.match(sql,/not gis\.ST_IsValid\(v_geom\)/);
  assert.match(sql,/gis\.ST_NPoints\(v_geom\)>12150/);
  assert.match(sql,/geometry_source in \('manual','external'\)/);
  assert.match(sql,/center_lat is not null or boundary_geojson is not null/);
});

test("review is advisor-only, locks records, and refuses to overwrite newer geometry",()=>{
  assert.match(review,/profile\?\.role!=="advisor"/);
  assert.match(sql,/not \(select app_private\.is_advisor\(\)\)/);
  assert.match(sql,/where id=p_proposal_id for update/);
  assert.match(sql,/where id=v_proposal\.field_id for update/);
  assert.match(sql,/v_field\.boundary_updated_at is distinct from v_proposal\.base_boundary_updated_at/);
  assert.match(sql,/update public\.fields set[\s\S]*?boundary_geojson=v_proposal\.boundary_geojson/);
  assert.match(sql,/status=case when p_approve then 'approved' else 'rejected' end/);
});

test("both parties can inspect full polygon geometry and make a deliberate decision",()=>{
  assert.match(editor,/previewGeometry\(candidate\.geometry,"external"/);
  assert.match(editor,/proposalMode\?"Táblahatár-javaslat beküldése"/);
  assert.match(editor,/submitFieldBoundaryProposal\(new FormData\(event\.currentTarget\)\)/);
  assert.match(comparison,/Jelenlegi határ/);
  assert.match(comparison,/Javasolt határ/);
  assert.match(advisor,/FieldBoundaryComparisonMap/);
  assert.match(advisor,/proposed=\{\{lat:proposal\.center_lat,lng:proposal\.center_lng,boundary:proposal\.boundary_geojson\}\}/);
  assert.match(advisor,/disabled=\{stale\}/);
  assert.match(review,/formData\.get\("confirmed"\)!=="on"/);
});

test("pending proposals notify advisors and approved decisions revalidate the field",()=>{
  assert.match(sql,/insert into public\.notifications\(user_id,kind,title,message,href,event_key\)/);
  assert.match(sql,/p\.role='advisor' and coalesce\(p\.system_role,'user'\)<>'admin'/);
  assert.match(review,/`\/fields\/\$\{fieldId\}`/);
  assert.match(review,/try\{revalidatePath\(path\)\}catch\(error\)/);
  assert.match(submission,/`\/fields\/\$\{fieldId\}`,"\/admin\/map\/proposals"/);
});
