import test from "node:test";
import assert from "node:assert/strict";
import {fieldFileCandidates} from "../lib/fieldFileCandidates.ts";

const polygon={type:"Polygon",coordinates:[[[19,47],[19.01,47],[19.02,47.003],[19,47]]]};
const multi={type:"MultiPolygon",coordinates:[polygon.coordinates]};

test("accepts an individual polygon without changing its vertices",()=>{
 const result=fieldFileCandidates(polygon);
 assert.equal(result.length,1);
 assert.deepEqual(result[0].geometry,polygon);
});

test("presents several GeoJSON features as separate choices rather than picking one",()=>{
 const results=fieldFileCandidates({type:"FeatureCollection",features:[
  {type:"Feature",properties:{HRSZ:"0123/4"},geometry:polygon},
  {type:"Feature",properties:{name:"Déli parcella"},geometry:multi},
 ]});
 assert.deepEqual(results.map(x=>x.label),["0123/4","Déli parcella"]);
 assert.deepEqual(results[1].geometry,multi);
});

test("accepts shapefile-js multiple layers and does not flatten MultiPolygon",()=>{
 const input=[{type:"FeatureCollection",fileName:"korabbi_meres",features:[{type:"Feature",properties:{},geometry:multi}]},{type:"FeatureCollection",fileName:"pontok",features:[{type:"Feature",properties:{},geometry:{type:"Point",coordinates:[19,47]}}]}];
 const results=fieldFileCandidates(input);
 assert.equal(results.length,1);
 assert.match(results[0].label,/korabbi_meres/);
 assert.deepEqual(results[0].geometry,multi);
});

test("rejects invalid or empty structures and only non-polygon measurements",()=>{
 assert.throws(()=>fieldFileCandidates({type:"FeatureCollection",features:null}),/hibás/);
 assert.throws(()=>fieldFileCandidates({type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"LineString",coordinates:[]}}]}),/nem tartalmaz/);
});

test("does not silently treat an EOV GeoJSON collection as WGS84",()=>{
 assert.throws(()=>fieldFileCandidates({type:"FeatureCollection",crs:{type:"name",properties:{name:"EPSG:23700"}},features:[{type:"Feature",geometry:polygon}]}),/nem WGS84/);
});

test("limits the count of features to avoid unwieldy selection",()=>{
 const features=Array.from({length:61},(_,i)=>({type:"Feature",properties:{id:i},geometry:polygon}));
 assert.throws(()=>fieldFileCandidates({type:"FeatureCollection",features}),/több mint 60/);
});

test("truncates imported properties and does not trust display names as markup",()=>{
 const results=fieldFileCandidates({type:"Feature",properties:{name:"<script>"+"x".repeat(120)},geometry:polygon});
 assert.equal(results[0].label.length,90);
 assert.match(results[0].label,/^<script>/);
});
