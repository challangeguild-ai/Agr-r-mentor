import test from "node:test";
import assert from "node:assert/strict";
import {pointInBoundary,pointInBoundaryHole,nearestBoundaryDistance,distanceMeters} from "../lib/taskProof.ts";

const outer=[[19,47],[19.02,47],[19.02,47.02],[19,47.02],[19,47]];
const hole=[[19.008,47.008],[19.012,47.008],[19.012,47.012],[19.008,47.012],[19.008,47.008]];
const field={type:"Polygon",coordinates:[outer]};
const fieldWithHole={type:"Polygon",coordinates:[outer,hole]};

test("a GPS point inside the mapped field is accepted as inside",()=>{
 assert.equal(pointInBoundary(47.01,19.01,field),true);
 assert.equal(pointInBoundary(47.01,18.9993,field),false);
});
test("distance to a long field side uses segments rather than distant corners",()=>{
 const edgeDistance=nearestBoundaryDistance(47.01,18.9993,field);
 assert.ok(edgeDistance!==null&&edgeDistance>40&&edgeDistance<70,edgeDistance);
 const nearestCorner=Math.min(...outer.map(([lng,lat])=>distanceMeters(47.01,18.9993,lat,lng)));
 assert.ok(nearestCorner>900,nearestCorner);
});
test("150 m boundary allowance still rejects genuinely distant GPS positions",()=>{
 assert.ok(nearestBoundaryDistance(47.01,18.9993,field)<150);
 assert.ok(nearestBoundaryDistance(47.01,18.996,field)>150);
});
test("inner holes are excluded even though surrounded by the field boundary",()=>{
 assert.equal(pointInBoundary(47.01,19.01,fieldWithHole),false);
 assert.equal(pointInBoundaryHole(47.01,19.01,fieldWithHole),true);
 assert.equal(pointInBoundary(47.015,19.015,fieldWithHole),true);
 assert.equal(pointInBoundaryHole(47.015,19.015,fieldWithHole),false);
 assert.ok(nearestBoundaryDistance(47.01,19.01,fieldWithHole)>150);
});
test("multipolygons measure the nearest exterior edge of either parcel",()=>{
 const parcel2=[[19.03,47],[19.05,47],[19.05,47.02],[19.03,47.02],[19.03,47]];
 const multi={type:"MultiPolygon",coordinates:[[outer,hole],[parcel2]]};
 assert.equal(pointInBoundary(47.01,19.04,multi),true);
 assert.equal(pointInBoundaryHole(47.01,19.01,multi),true);
 const near=nearestBoundaryDistance(47.01,19.0507,multi);
 assert.ok(near!==null&&near>40&&near<70,near);
});
test("missing or invalid GeoJSON cannot produce a fabricated distance",()=>{
 assert.equal(nearestBoundaryDistance(47,19,null),null);
 assert.equal(nearestBoundaryDistance(47,19,{type:"Point",coordinates:[19,47]}),null);
 assert.equal(nearestBoundaryDistance(47,19,{type:"Polygon",coordinates:[[]]}),null);
 assert.equal(pointInBoundary(47,19,{type:"Point",coordinates:[19,47]}),false);
 assert.equal(pointInBoundaryHole(47,19,null),false);
});
