import test from "node:test";
import assert from "node:assert/strict";
import {assessFieldBoundary} from "../lib/fieldBoundaryQuality.ts";

function square(x1,y1,x2,y2){return [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]}
const outer=square(19,47,19.01,47.01);
const shape={type:"Polygon",coordinates:[outer]};
const issueCodes=report=>report.issues.map(issue=>issue.code);
const other=(geometry,name="Második tábla")=>[{id:"other",name,boundary:geometry}];

test("a credible WGS84 polygon reports estimated hectares and preserved vertices",()=>{
  const report=assessFieldBoundary({geometry:shape});
  assert.equal(report.vertices,4);
  assert.equal(report.polygonCount,1);
  assert.ok(report.estimatedHa>70&&report.estimatedHa<85);
  assert.deepEqual(report.issues,[]);
});

test("missing registered area does not create a fake area mismatch",()=>{
  assert.ok(!issueCodes(assessFieldBoundary({geometry:shape,declaredHa:null})).includes("area_mismatch"));
  assert.ok(!issueCodes(assessFieldBoundary({geometry:shape,declaredHa:0})).includes("area_mismatch"));
});

test("significant area mismatch warns without rejecting valid polygons",()=>{
  const tooSmall=assessFieldBoundary({geometry:shape,declaredHa:10});
  const tooLarge=assessFieldBoundary({geometry:shape,declaredHa:300});
  assert.ok(issueCodes(tooSmall).includes("area_mismatch"));
  assert.ok(issueCodes(tooLarge).includes("area_mismatch"));
  assert.ok(tooSmall.estimatedHa>0);
  assert.equal(tooSmall.issues.find(i=>i.code==="area_mismatch").severity,"warning");
});

test("a geometry moved kilometres away from the stored field point is flagged",()=>{
  assert.ok(issueCodes(assessFieldBoundary({geometry:shape,oldLat:48.1,oldLng:20.1})).includes("far_from_existing"));
  assert.ok(!issueCodes(assessFieldBoundary({geometry:shape,oldLat:47.005,oldLng:19.005})).includes("far_from_existing"));
});

test("a point-only proposal remains available but warns about replacing an existing polygon",()=>{
  const report=assessFieldBoundary({geometry:null,proposedLat:47.01,proposedLng:19.01,oldBoundary:shape});
  assert.equal(report.estimatedHa,null);
  assert.equal(report.vertices,0);
  assert.ok(issueCodes(report).includes("point_replaces_polygon"));
  assert.equal(assessFieldBoundary({geometry:null}).issues.length,0);
});

test("an implausibly relocated point is flagged even without polygon",()=>{
  assert.ok(issueCodes(assessFieldBoundary({geometry:null,proposedLat:46,proposedLng:18,oldLat:47,oldLng:19})).includes("far_from_existing"));
});

test("a genuine intersecting polygon is detected as a possible overlapping field",()=>{
  const overlapping={type:"Polygon",coordinates:[square(19.005,47.005,19.015,47.015)]};
  const report=assessFieldBoundary({geometry:shape,neighbors:other(overlapping)});
  assert.ok(issueCodes(report).includes("neighbor_overlap"));
  assert.match(report.issues.find(i=>i.code==="neighbor_overlap").title,/Második tábla/);
  assert.equal(report.overlapChecked,1);
});

test("a common field boundary is not treated as overlap",()=>{
  const touching={type:"Polygon",coordinates:[square(19.01,47,19.02,47.01)]};
  const report=assessFieldBoundary({geometry:shape,neighbors:other(touching)});
  assert.ok(!issueCodes(report).includes("neighbor_overlap"));
});

test("distant polygons do not cause overlap warnings",()=>{
  const remote={type:"Polygon",coordinates:[square(19.2,47.2,19.21,47.21)]};
  assert.ok(!issueCodes(assessFieldBoundary({geometry:shape,neighbors:other(remote)})).includes("neighbor_overlap"));
});

test("identical geometry and strictly contained polygon are detected",()=>{
  const inside={type:"Polygon",coordinates:[square(19.002,47.002,19.004,47.004)]};
  assert.ok(issueCodes(assessFieldBoundary({geometry:shape,neighbors:other(shape)})).includes("neighbor_overlap"));
  assert.ok(issueCodes(assessFieldBoundary({geometry:shape,neighbors:other(inside)})).includes("neighbor_overlap"));
});

test("a polygon inside a mapped interior hole is not reported as overlap",()=>{
  const donut={type:"Polygon",coordinates:[outer,square(19.002,47.002,19.008,47.008)]};
  const inHole={type:"Polygon",coordinates:[square(19.003,47.003,19.007,47.007)]};
  assert.ok(!issueCodes(assessFieldBoundary({geometry:donut,neighbors:other(inHole)})).includes("neighbor_overlap"));
});

test("a MultiPolygon checks every disconnected part",()=>{
  const multi={type:"MultiPolygon",coordinates:[[outer],[square(19.05,47.05,19.06,47.06)]]};
  const second={type:"Polygon",coordinates:[square(19.055,47.055,19.065,47.065)]};
  const report=assessFieldBoundary({geometry:multi,neighbors:other(second)});
  assert.equal(report.polygonCount,2);
  assert.ok(issueCodes(report).includes("neighbor_overlap"));
});

test("an incomplete neighbor list is explicitly reported as partial, never clean",()=>{
  const report=assessFieldBoundary({geometry:shape,neighborsTruncated:true});
  assert.ok(issueCodes(report).includes("overlap_incomplete"));
});

test("bad existing neighbor does not crash review, but suppresses false certainty",()=>{
  const report=assessFieldBoundary({geometry:shape,neighbors:other({type:"Polygon",coordinates:[]})});
  assert.ok(issueCodes(report).includes("overlap_incomplete"));
});

test("invalid new geometry is rejected rather than called accurate",()=>{
  assert.throws(()=>assessFieldBoundary({geometry:{type:"Point",coordinates:[19,47]}}),/Csak Polygon/);
});
