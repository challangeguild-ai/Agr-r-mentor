import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const editor=read("../components/FieldMapEditor.tsx");
const launcher=read("../components/FieldBoundaryProposalLauncher.tsx");
const farmer=read("../app/fields/[id]/page.tsx");
const advisor=read("../app/admin/map/proposals/[id]/page.tsx");
const quality=read("../app/admin/map/quality/page.tsx");

test("farmer sees local quality feedback before submitting any optional polygon",()=>{
  assert.match(editor,/assessFieldBoundary\(\{geometry:geojson\?JSON\.parse\(geojson\):null/);
  assert.match(editor,/\<FieldBoundaryQualityPanel quality=\{quality\}/);
  assert.match(launcher,/areaHa=\{areaHa\}/);
  assert.match(farmer,/areaHa=\{field\.area_ha\}/);
  assert.match(editor,/proposalMode\?"Táblahatár-javaslat beküldése"/);
});

test("advisor receives additional bounded neighbor checks with explicit cap and no hidden assurance",()=>{
  assert.match(advisor,/\.eq\("farm_id",proposal\.farm_id\)/);
  assert.match(advisor,/\.neq\("id",proposal\.field_id\)/);
  assert.match(advisor,/\.limit\(50\)/);
  assert.match(advisor,/neighborsTruncated:!!neighborsError\|\|\(neighborsCount\?\?0\)>50/);
  assert.match(advisor,/FieldBoundaryQualityPanel quality=\{quality\}/);
  assert.match(advisor,/FieldBoundaryComparisonMap/);
});

test("quality overview remains advisor-only and bounded/paginated for large farms",()=>{
  assert.match(quality,/me\?\.role!=="advisor"/);
  assert.match(quality,/PAGE_SIZE=50/);
  assert.match(quality,/\.range\(\(page-1\)\*PAGE_SIZE,page\*PAGE_SIZE-1\)/);
  assert.match(quality,/\.select\("id,name,farm_id,area_ha,center_lat,center_lng,boundary_geojson",\{count:"exact"\}\)/);
  assert.match(quality,/A területadatot a tárolt poligonnal vetjük össze/);
});
