import test from "node:test";
import assert from "node:assert/strict";
import {nearbyStations,latestMeasuredDate} from "../lib/weather/stationSelection.ts";

const station=(number,latitude,longitude)=>({stationNumber:number,name:number,latitude,longitude});

test("backup choices are distance-ordered, bounded and never leave the 35 km radius",()=>{
 const candidates=nearbyStations([
  station("far",48.3,19),
  station("third",47.55,19),
  station("nearest",47.501,19),
  station("second",47.52,19),
  station("fourth",47.58,19)
 ],47.5,19,35,3);
 assert.deepEqual(candidates.map(x=>x.station.stationNumber),["nearest","second","third"]);
 assert.ok(candidates.every(x=>x.distanceKm<=35));
 assert.deepEqual(nearbyStations([station("far",48.3,19)],47.5,19,35),[]);
});

test("measured zero is fresh, -999/missing/future data are never fresh",()=>{
 const rows=[
  {date:"2026-11-16",precipitationMm:0},
  {date:"2026-11-17",precipitationMm:null},
  {date:"2026-11-18",precipitationMm:null},
  {date:"2026-11-20",precipitationMm:12},
  {date:"2026-11-14",precipitationMm:8}
 ];
 assert.equal(latestMeasuredDate(rows,"2026-11-16","2026-11-19"),"2026-11-16");
 assert.equal(latestMeasuredDate(rows,"2026-11-17","2026-11-19"),null);
 assert.equal(latestMeasuredDate(rows,"2026-11-01","2026-11-19"),"2026-11-16");
});
