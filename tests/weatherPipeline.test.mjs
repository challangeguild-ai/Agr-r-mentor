import test from "node:test";
import assert from "node:assert/strict";
import {parseHungaroMetDailyCsv} from "../lib/weather/hungarometParsing.ts";
import {summarizeStationPrecipitation} from "../lib/weather/rollingPrecipitation.ts";
import {planWeatherTimelineChanges} from "../lib/weather/syncHelpers.ts";

test("official-format daily CSV leads to a correct 7-day rainfall journal and one-time timeline",()=>{
 const csv=`##Meta
#StationNumber;StartDate;EndDate;Latitude;Longitude;Elevation;StationName;EOR
#73211;20260101;20261118;47.5;19;100;Budapest;EOR
##Meta END
StationNumber;Time;rau;Q_rau;tn;Q_tn;tx;Q_tx;EOR
73211;20261114;0;;4;;8;;EOR
73211;20261115;6.2;;5;;9;;EOR
73211;20261116;-999;;3;;10;;EOR
73211;20261117;0;;4;;10;;EOR
73211;20261118;2.3;;5;;12;;EOR`;
 const parsed=parseHungaroMetDailyCsv(csv,"73211");
 const measured=parsed.filter(x=>x.precipitationMm!=null).map((x,i)=>({
  id:`measurement-${i}`,field_id:"field-1",weather_date:x.date,source_type:"measured",
  precipitation_mm:x.precipitationMm,distance_km:7,station_name:"Budapest",fetched_at:"2026-11-19T10:00:00Z"
 }));
 const summary=summarizeStationPrecipitation(measured,new Date("2026-11-19T15:00:00Z"));
 assert.equal(summary.days7,4);
 assert.equal(summary.rainyDays7,2);
 assert.equal(summary.rain7,8.5);
 assert.deepEqual(summary.recentMeasurements.map(x=>x.weather_date),[
  "2026-11-18","2026-11-17","2026-11-15","2026-11-14"
 ]);
 const plan=planWeatherTimelineChanges(measured,[],{id:"field-1",farm_id:"farm-1"},"73211","official-url");
 assert.equal(plan.inserts.length,2);
 assert.equal(plan.updates.length,0);
 const rerun=planWeatherTimelineChanges(measured,plan.inserts.map(x=>({
  source_id:x.source_id,title:x.title,description:x.description
 })),{id:"field-1",farm_id:"farm-1"},"73211","official-url");
 assert.deepEqual(rerun,{inserts:[],updates:[]});
});
