import test from "node:test";
import assert from "node:assert/strict";
import {fieldPoint,fetchAllWeatherFields,weatherSyncStatus,planWeatherTimelineChanges} from "../lib/weather/syncHelpers.ts";

test("weather station matching prefers a valid field center",()=>{
 const point=fieldPoint({center_lat:47.5,center_lng:19.2,boundary_geojson:null});
 assert.deepEqual(point,{lat:47.5,lng:19.2});
 assert.equal(fieldPoint({center_lat:null,center_lng:null,boundary_geojson:null}),null);
});

test("missing or invalid centers fall back to a proper polygon centroid, not a duplicate closing vertex",()=>{
 const polygon={type:"Polygon",coordinates:[[[19,47],[21,47],[21,49],[19,49],[19,47]]]};
 const point=fieldPoint({center_lat:999,center_lng:19,boundary_geojson:polygon});
 assert.ok(point);
 assert.ok(Math.abs(point.lat-48)<1e-8);
 assert.ok(Math.abs(point.lng-20)<1e-8);
 const unlocated=fieldPoint({center_lat:0,center_lng:0,boundary_geojson:polygon});
 assert.ok(unlocated);
 assert.ok(Math.abs(unlocated.lat-48)<1e-8);
});

test("disjoint fields use an area-weighted centroid from every polygon part",()=>{
 const multipolygon={type:"MultiPolygon",coordinates:[
  [[[18,47],[19,47],[19,48],[18,48],[18,47]]],
  [[[20,47],[22,47],[22,49],[20,49],[20,47]]]
 ]};
 const point=fieldPoint({center_lat:null,center_lng:null,boundary_geojson:{type:"Feature",geometry:multipolygon}});
 assert.ok(point);
 assert.ok(Math.abs(point.lng-20.5)<1e-8);
 assert.ok(Math.abs(point.lat-47.9)<1e-8);
});

test("field list paging reads past Supabase's default first 1000 rows",async()=>{
 const expected=Array.from({length:1201},(_,i)=>({id:i}));
 const ranges=[];
 const fields=await fetchAllWeatherFields(async(from,to)=>{
  ranges.push([from,to]);
  return {data:expected.slice(from,to+1),error:null};
 });
 assert.deepEqual(fields,expected);
 assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
});

test("a later page failure cannot silently mark a partial field list as complete",async()=>{
 let calls=0;
 await assert.rejects(fetchAllWeatherFields(async()=>{
  calls++;
  return calls===1?{data:Array.from({length:500},(_,i)=>i),error:null}:
   {data:null,error:{message:"connection lost"}};
 }),/connection lost/);
 assert.equal(calls,2);
});

test("weather sync reports partial results whenever some fields or stations are missing",()=>{
 assert.equal(weatherSyncStatus(0,0,0),"success");
 assert.equal(weatherSyncStatus(7,0,0),"partial");
 assert.equal(weatherSyncStatus(7,6,0),"partial");
 assert.equal(weatherSyncStatus(7,7,1),"partial");
 assert.equal(weatherSyncStatus(7,7,0),"success");
 assert.equal(weatherSyncStatus(7,7,0,1),"partial");
});

test("initial rainy-day import creates only a rain event, not dry-day noise",()=>{
 const rows=[
  {id:"rain",weather_date:"2026-11-18",precipitation_mm:4.5,distance_km:7,station_name:"Budapest"},
  {id:"dry",weather_date:"2026-11-17",precipitation_mm:0,distance_km:7,station_name:"Budapest"}
 ];
 const result=planWeatherTimelineChanges(rows,[],{id:"field-1",farm_id:"farm-1"},"73211","https://example.invalid/official.pdf");
 assert.equal(result.inserts.length,1);
 assert.equal(result.updates.length,0);
 assert.equal(result.inserts[0].source_id,"rain");
 assert.equal(result.inserts[0].title,"Csapadék: 4,5 mm");
 assert.equal(result.inserts[0].event_at,"2026-11-18T12:00:00Z");
 assert.equal(result.inserts[0].technical_payload.measurement_period,"06_utc_to_next_06_utc");
});

test("rerun is idempotent, while corrected rain updates its existing timeline event",()=>{
 const row={id:"rain",weather_date:"2026-11-18",precipitation_mm:4.5,distance_km:7,station_name:"Budapest"};
 const field={id:"field-1",farm_id:"farm-1"};
 const first=planWeatherTimelineChanges([row],[],field,"73211","official-url");
 const event={source_id:"rain",title:first.inserts[0].title,description:first.inserts[0].description};
 const retry=planWeatherTimelineChanges([row],[event],field,"73211","official-url");
 assert.deepEqual(retry,{inserts:[],updates:[]});
 const corrected=planWeatherTimelineChanges([{...row,precipitation_mm:6}],[event],field,"73211","official-url");
 assert.equal(corrected.inserts.length,0);
 assert.equal(corrected.updates.length,1);
 assert.equal(corrected.updates[0].title,"Csapadék: 6 mm");
 const changedToDry=planWeatherTimelineChanges([{...row,precipitation_mm:0}],[event],field,"73211","official-url");
 assert.equal(changedToDry.inserts.length,0);
 assert.equal(changedToDry.updates[0].title,"Csapadék helyesbítve: 0 mm");
});

test("switching to a backup station updates the same day's timeline rather than duplicating it",()=>{
 const field={id:"field-1",farm_id:"farm-1"};
 const previous={id:"old-event",event_at:"2026-11-18T12:00:00Z",source_id:"primary-record",title:"Csapadék: 3 mm",description:"Régi mérés"};
 const newRow={id:"backup-record",weather_date:"2026-11-18",precipitation_mm:7,distance_km:13,station_name:"Tartalék"};
 const result=planWeatherTimelineChanges([newRow],[previous],field,"backup-station","official-url");
 assert.equal(result.inserts.length,0);
 assert.equal(result.updates.length,1);
 assert.equal(result.updates[0].event_id,"old-event");
 assert.equal(result.updates[0].source_id,"backup-record");
 assert.equal(result.updates[0].technical_payload.station_number,"backup-station");
 const repeat=planWeatherTimelineChanges([newRow],[{
  ...previous,source_id:"backup-record",title:result.updates[0].title,description:result.updates[0].description
 }],field,"backup-station","official-url");
 assert.deepEqual(repeat,{inserts:[],updates:[]});
});

test("invalid stored precipitation fails before generating an event",()=>{
 assert.throws(()=>planWeatherTimelineChanges([
  {id:"rain",weather_date:"2026-11-18",precipitation_mm:-999,distance_km:7,station_name:"Budapest"}
 ],[],{id:"field",farm_id:"farm"},"73211","official-url"),/Érvénytelen/);
});
