import test from "node:test";
import assert from "node:assert/strict";
import {estimatedFieldHectares,prepareFieldBatch,MAX_BULK_FIELDS} from "../lib/fieldBatchImport.ts";
import {escapeHtml} from "../lib/escapeHtml.ts";
import {fieldLocationHint} from "../lib/fieldLocationHint.ts";

const outer=[[19.1,47.1],[19.102,47.1],[19.102,47.102],[19.1,47.102],[19.1,47.1]];
const other=[[19.2,47.2],[19.201,47.2],[19.201,47.201],[19.2,47.201],[19.2,47.2]];
const hole=[[19.1005,47.1005],[19.101,47.1005],[19.101,47.101],[19.1005,47.101],[19.1005,47.1005]];
const a={type:"Polygon",coordinates:[outer]};
const b={type:"Polygon",coordinates:[other]};

test("prepares multiple distinct irregular fields with approximate hectares and centers",()=>{
  const rows=prepareFieldBatch([{name:"  Első  tábla ",geometry:a},{name:"Második",geometry:b}]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,"Első tábla");
  assert.equal(rows[0].geometry.coordinates[0].length,outer.length);
  assert.ok(rows[0].area_ha>3&&rows[0].area_ha<4);
  assert.ok(rows[0].center_lat>47.1&&rows[0].center_lat<47.1021);
});

test("holes subtract and disjoint multipolygons add to the approximate area",()=>{
  const withHole={type:"Polygon",coordinates:[outer,hole]};
  const mp={type:"MultiPolygon",coordinates:[[outer],[other]]};
  assert.ok(estimatedFieldHectares(withHole)<estimatedFieldHectares(a));
  assert.ok(estimatedFieldHectares(mp)>estimatedFieldHectares(a));
  assert.deepEqual(prepareFieldBatch([{name:"Két darab",geometry:mp}])[0].geometry,mp);
});

test("rejects duplicate names, including whitespace and case variations and existing farm fields",()=>{
  assert.throws(()=>prepareFieldBatch([{name:"Tábla 1",geometry:a},{name:"  tábla   1 ",geometry:b}]),/Már létezik/);
  assert.throws(()=>prepareFieldBatch([{name:"Táblázat",geometry:a}],[{name:"táblázat"}]),/Már létezik/);
});

test("rejects duplicate geometries, invalid positions and too many fields",()=>{
  assert.throws(()=>prepareFieldBatch([{name:"A",geometry:a},{name:"B",geometry:a}]),/Azonos geometriát/);
  assert.throws(()=>prepareFieldBatch([{name:"A",geometry:a}],[{name:"Más név",geometry:a}]),/Azonos geometriát/);
  assert.throws(()=>prepareFieldBatch([{name:"Rossz",geometry:{type:"Polygon",coordinates:[[[700000,230000]]]}}]),/legalább három/);
  assert.throws(()=>prepareFieldBatch([]),/Egyszerre/);
  assert.throws(()=>prepareFieldBatch(Array.from({length:MAX_BULK_FIELDS+1},(_,i)=>({name:`${i}`,geometry:a}))),/Egyszerre/);
});

test("rejects oversized geometry payloads, blank and excessive names",()=>{
  assert.throws(()=>prepareFieldBatch([{name:" ",geometry:a}]),/név/);
  assert.throws(()=>prepareFieldBatch([{name:"A".repeat(121),geometry:a}]),/név/);
  const huge=JSON.parse(JSON.stringify(a));
  huge.coordinates=[Array.from({length:60000},(_,i)=>[19+i/10000000,47+i/10000000])];
  assert.throws(()=>prepareFieldBatch([{name:"Nagy",geometry:huge}]),/túl sok koordinátát/);
});

test("untrusted field labels are escaped before being inserted into Leaflet HTML popups",()=>{
  const label='Rossz <img src=x onerror="alert(1)"> & társai';
  const escaped=escapeHtml(label);
  assert.equal(escaped,'Rossz &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; társai');
  assert.ok(!escaped.includes("<img"));
  assert.equal(escapeHtml(null),"");
});

test("geographic sanity warning catches likely swapped axes without rejecting foreign fields",()=>{
  assert.equal(fieldLocationHint(19.1,47.1),null);
  assert.equal(fieldLocationHint(20.5,48.9),null);
  assert.match(fieldLocationHint(47.1,19.1),/felcserélt/);
  assert.match(fieldLocationHint(3.1,47.1),/kívül esik/);
  assert.match(fieldLocationHint(100,10),/kívül esik/);
  assert.match(fieldLocationHint(NaN,47),/nem értelmezhető/);
});
