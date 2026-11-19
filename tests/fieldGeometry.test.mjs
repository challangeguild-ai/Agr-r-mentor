import test from "node:test";
import assert from "node:assert/strict";
import {parseFieldGeometry,parseFieldGeometryText} from "../lib/fieldGeometry.ts";

const irregular=[[19.12,47.1],[19.128,47.103],[19.127,47.109],[19.123,47.107],[19.119,47.11],[19.12,47.1]];
const hole=[[19.123,47.104],[19.124,47.104],[19.124,47.105],[19.123,47.104]];
const geom={type:"Polygon",coordinates:[irregular,hole]};

test("preserves every irregular boundary vertex, closing point and interior hole",()=>{
  const result=parseFieldGeometryText(JSON.stringify(geom));
  assert.deepEqual(result.geometry,geom);
  assert.equal(result.stats.vertices,8);
  assert.equal(result.stats.holes,1);
  assert.equal(result.stats.polygons,1);
});

test("imports a one-feature GeoJSON FeatureCollection",()=>{
  const result=parseFieldGeometry({type:"FeatureCollection",features:[{type:"Feature",properties:{hrsz:"0123/4"},geometry:geom}]});
  assert.deepEqual(result.geometry,geom);
});

test("retains every part of a MultiPolygon with holes",()=>{
  const mp={type:"MultiPolygon",coordinates:[geom.coordinates,[[[19.2,47.2],[19.21,47.2],[19.2,47.21],[19.2,47.2]]] ]};
  assert.deepEqual(parseFieldGeometry(mp).geometry,mp);
  assert.equal(parseFieldGeometry(mp).stats.polygons,2);
});

test("rejects EOV coordinates instead of interpreting them as GPS",()=>{
  assert.throws(()=>parseFieldGeometry({type:"Polygon",coordinates:[[[700000,240000],[700100,240000],[700000,240100],[700000,240000]]]}),/WGS84/);
  assert.throws(()=>parseFieldGeometry({...geom,crs:{type:"name",properties:{name:"EPSG:23700"}}}),/vetülete/);
});

test("rejects incomplete rings and malformed positions",()=>{
  assert.throws(()=>parseFieldGeometry({type:"Polygon",coordinates:[irregular.slice(0,-1)]}),/nincs lezárva/);
  assert.throws(()=>parseFieldGeometry({type:"Polygon",coordinates:[[[19,47],[19.1,47],[19.2,47],[19,47]]]}),/területe nulla/);
  assert.throws(()=>parseFieldGeometry({type:"Polygon",coordinates:[[[19,47],[19.1,47],[19.1,47],[19,47]]]}),/Azonos szomszédos/);
});

test("rejects ambiguous collections instead of picking the first parcel",()=>{
  assert.throws(()=>parseFieldGeometry({type:"FeatureCollection",features:[{type:"Feature",geometry:geom},{type:"Feature",geometry:geom}]}),/pontosan egy/);
});

test("rejects overlarge files and unsafe geometry structures",()=>{
  assert.throws(()=>parseFieldGeometryText(" ".repeat(2_000_001)),/túl nagy/);
  assert.throws(()=>parseFieldGeometry({type:"GeometryCollection",geometries:[geom]}),/Csak Polygon/);
  assert.throws(()=>parseFieldGeometry({type:"Polygon",coordinates:[]}),/külső/);
});
