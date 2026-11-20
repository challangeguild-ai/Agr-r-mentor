import test from "node:test";
import assert from "node:assert/strict";
import {osmFieldSuggestions} from "../lib/osmFieldBoundary.ts";

const rect=[{lat:47,lon:19},{lat:47,lon:19.01},{lat:47.01,lon:19.01},{lat:47.01,lon:19},{lat:47,lon:19}];
const way=(id,geometry=rect,landuse="farmland")=>({type:"way",id,tags:{landuse},geometry});

test("suggests a real closed field outline containing the clicked point, retaining every vertex",()=>{
  const result=osmFieldSuggestions({elements:[way(123)]},47.005,19.005);
  assert.equal(result.length,1);
  assert.equal(result[0].id,"osm:way:123");
  assert.equal(result[0].vertices,4);
  assert.deepEqual(result[0].geometry.coordinates[0],rect.map(p=>[p.lon,p.lat]));
  assert.ok(result[0].approximateHa>50);
});

test("excludes nearby agricultural polygons which do not contain the clicked position",()=>{
  assert.deepEqual(osmFieldSuggestions({elements:[way(1)]},47.2,19.2),[]);
});

test("rejects unclosed OSM ways rather than inventing a boundary",()=>{
  assert.deepEqual(osmFieldSuggestions({elements:[way(1,rect.slice(0,-1))]},47.005,19.005),[]);
});

test("ignores non-farm, malformed, missing-coordinate and non-way features",()=>{
  const mixed=[way(1,rect,"residential"),way(2,rect.slice(0,2)),way(3,[...rect.slice(0,-1),{lat:200,lon:19}]),{...way(4),type:"relation"}];
  assert.deepEqual(osmFieldSuggestions({elements:mixed},47.005,19.005),[]);
  assert.deepEqual(osmFieldSuggestions({error:"maintenance"},47.005,19.005),[]);
});

test("shows at most five candidate field boundaries and no automatic selection",()=>{
  const many=Array.from({length:30},(_,i)=>way(i+1));
  const found=osmFieldSuggestions({elements:many},47.005,19.005);
  assert.equal(found.length,5);
  assert.ok(found.every(item=>item.id.startsWith("osm:way:")));
});

test("supports common agricultural landuse categories but no claims of legal precision",()=>{
  for(const type of ["farmland","meadow","orchard","vineyard"]){
    const found=osmFieldSuggestions({elements:[way(1,rect,type)]},47.005,19.005);
    assert.equal(found.length,1);
  }
});
