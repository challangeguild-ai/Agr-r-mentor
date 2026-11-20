import test from "node:test";
import assert from "node:assert/strict";
import {gpsFixFreshEnough,MAX_TASK_GPS_AGE_MS,encodeTaskProof,decodeTaskProof} from "../lib/taskProof.ts";

const now=Date.parse("2026-11-19T10:00:00.000Z");

test("a recent GPS measurement can be submitted",()=>{
 assert.equal(gpsFixFreshEnough(now,now),true);
 assert.equal(gpsFixFreshEnough(now-5*60_000,now),true);
});

test("GPS fix is accepted exactly at the 15-minute boundary, but rejected just after",()=>{
 assert.equal(MAX_TASK_GPS_AGE_MS,15*60_000);
 assert.equal(gpsFixFreshEnough(now-MAX_TASK_GPS_AGE_MS,now),true);
 assert.equal(gpsFixFreshEnough(now-MAX_TASK_GPS_AGE_MS-1,now),false);
});

test("small device clock skew is tolerated but implausibly future-dated measurements fail",()=>{
 assert.equal(gpsFixFreshEnough(now+120_000,now),true);
 assert.equal(gpsFixFreshEnough(now+120_001,now),false);
});

test("missing, malformed and non-finite GPS timestamps are rejected",()=>{
 for(const timestamp of [0,-1,NaN,Infinity,-Infinity,Number(undefined)]){
  assert.equal(gpsFixFreshEnough(timestamp,now),false,String(timestamp));
 }
 assert.equal(gpsFixFreshEnough(now,NaN),false);
 assert.equal(gpsFixFreshEnough(now,0),false);
});

test("GPS proof preserves the measurement time, independently of submission time",()=>{
 const capturedAt=new Date(now-9*60_000).toISOString();
 const proof=decodeTaskProof(encodeTaskProof({
  lat:47.2,lng:19.2,accuracy:12,photoPath:"user/task-proofs/example/photo.jpg",
  photoName:"photo.jpg",capturedAt,validation:"inside_boundary",
 }));
 assert.equal(proof?.capturedAt,capturedAt);
 assert.notEqual(proof?.capturedAt,new Date(now).toISOString());
});
