import test from "node:test";
import assert from "node:assert/strict";
import {budapestCalendarDate,summarizeStationPrecipitation} from "../lib/weather/rollingPrecipitation.ts";

test("Budapest calendar day is stable around midnight and DST",()=>{
 assert.equal(budapestCalendarDate(new Date("2026-03-29T22:30:00Z")),"2026-03-30");
 assert.equal(budapestCalendarDate(new Date("2026-10-25T00:30:00Z")),"2026-10-25");
});
test("seven-day and thirty-day windows use whole calendar days, not elapsed hours",()=>{
 const now=new Date("2026-11-18T00:30:00Z");
 const rain=[
 {weather_date:"2026-11-18",precipitation_mm:3},
 {weather_date:"2026-11-12",precipitation_mm:5},
 {weather_date:"2026-11-11",precipitation_mm:7},
 {weather_date:"2026-10-20",precipitation_mm:11},
 {weather_date:"2026-10-19",precipitation_mm:17},
 ];
 const v=summarizeStationPrecipitation(rain,now);
 assert.deepEqual([v.rain7,v.days7,v.rain30,v.days30],[8,2,26,4]);
 assert.deepEqual([v.rainyDays7,v.rainyDays30],[2,4]);
 assert.equal(v.latestObservedDate,"2026-11-18");
});
test("duplicate station rows do not double-count precipitation",()=>{
 const rows=[
 {weather_date:"2026-11-18",precipitation_mm:10,fetched_at:"2026-11-18T11:00:00Z"},
 {weather_date:"2026-11-18",precipitation_mm:2,fetched_at:"2026-11-18T12:00:00Z"},
 {weather_date:"2026-11-17",precipitation_mm:0,fetched_at:"2026-11-18T12:00:00Z"},
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-18T18:00:00Z"));
 assert.deepEqual([v.rain7,v.days7],[2,2]);
 assert.deepEqual([v.rainyDays7,v.rainyDays30],[1,1]);
 assert.deepEqual(v.recentMeasurements.map(x=>[x.weather_date,x.precipitation_mm]),[
  ["2026-11-18",2],["2026-11-17",0]
 ]);
});
test("missing and invalid observations are not mistaken for measured zero rain",()=>{
 const rows=[
 {weather_date:"2026-11-18",precipitation_mm:null},
 {weather_date:"2026-11-17",precipitation_mm:-2},
 {weather_date:"2026-11-16",precipitation_mm:0},
 {weather_date:"bad-date",precipitation_mm:12},
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-18T12:00:00Z"));
 assert.deepEqual([v.rain7,v.days7],[0,1]);
 assert.deepEqual([v.rainyDays7,v.rainyDays30],[0,0]);
 assert.deepEqual(v.recentMeasurements.map(x=>x.weather_date),["2026-11-16"]);
});
test("missing days never inflate the rainy-day count or masquerade as dry measurements",()=>{
 const rows=[
  {weather_date:"2026-11-19",precipitation_mm:0},
  {weather_date:"2026-11-18",precipitation_mm:"0.01"},
  {weather_date:"2026-11-17",precipitation_mm:null},
  {weather_date:"2026-11-16",precipitation_mm:""},
  {weather_date:"2026-11-15",precipitation_mm:"3.5"},
  {weather_date:"2026-11-20",precipitation_mm:99},
  {weather_date:"2026-10-20",precipitation_mm:99}
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-19T20:00:00Z"));
 assert.equal(v.rain7,3.51);
 assert.equal(v.rain30,3.51);
 assert.equal(v.days7,3);
 assert.equal(v.days30,3);
 assert.equal(v.rainyDays7,2);
 assert.equal(v.rainyDays30,2);
 assert.equal(v.latestObservedDate,"2026-11-19");
 assert.deepEqual(v.recentMeasurements.map(x=>x.weather_date),["2026-11-19","2026-11-18","2026-11-15"]);
});
test("a newer zero reading supersedes an older rain reading for the same day",()=>{
 const rows=[
  {weather_date:"2026-11-19",precipitation_mm:7,fetched_at:"2026-11-19T08:00:00Z"},
  {weather_date:"2026-11-19",precipitation_mm:0,fetched_at:"2026-11-19T10:00:00Z"}
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-19T12:00:00Z"));
 assert.deepEqual([v.rain7,v.days7,v.rainyDays7],[0,1,0]);
});
test("a forecast or calculated amount cannot be counted as an observed rainy day",()=>{
 const rows=[
  {weather_date:"2026-11-19",precipitation_mm:20,source_type:"forecast",fetched_at:"2026-11-19T13:00:00Z"},
  {weather_date:"2026-11-19",precipitation_mm:0,source_type:"measured",fetched_at:"2026-11-19T12:00:00Z"},
  {weather_date:"2026-11-18",precipitation_mm:13,source_type:"calculated"},
  {weather_date:"2026-11-17",precipitation_mm:"  ",source_type:"measured"}
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-19T20:00:00Z"));
 assert.deepEqual([v.rain7,v.days7,v.rainyDays7],[0,1,0]);
 assert.deepEqual(v.recentMeasurements.map(x=>x.weather_date),["2026-11-19"]);
});
