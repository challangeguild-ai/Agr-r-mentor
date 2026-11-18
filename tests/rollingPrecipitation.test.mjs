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
});
test("duplicate station rows do not double-count precipitation",()=>{
 const rows=[
 {weather_date:"2026-11-18",precipitation_mm:10,fetched_at:"2026-11-18T11:00:00Z"},
 {weather_date:"2026-11-18",precipitation_mm:2,fetched_at:"2026-11-18T12:00:00Z"},
 {weather_date:"2026-11-17",precipitation_mm:0,fetched_at:"2026-11-18T12:00:00Z"},
 ];
 const v=summarizeStationPrecipitation(rows,new Date("2026-11-18T18:00:00Z"));
 assert.deepEqual([v.rain7,v.days7],[2,2]);
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
});
