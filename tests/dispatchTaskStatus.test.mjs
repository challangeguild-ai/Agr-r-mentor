import test from "node:test";
import assert from "node:assert/strict";
import {dispatchTaskStatusLabel} from "../lib/dispatchTaskStatus.ts";

test("assigned work is not confused with submitted or completed work",()=>{
 assert.equal(dispatchTaskStatusLabel("open","not_required"),"Kiosztva");
 assert.equal(dispatchTaskStatusLabel("in_progress",null),"Folyamatban");
 assert.equal(dispatchTaskStatusLabel("submitted","pending"),"Ellenőrzésre vár");
 assert.equal(dispatchTaskStatusLabel("done","approved"),"Elvégezve");
});
test("rejected reviews are visible even if the task was previously submitted",()=>{
 assert.equal(dispatchTaskStatusLabel("submitted","rejected"),"Javításra visszaküldve");
});
test("unexpected statuses are not shown as ordinary assigned tasks",()=>{
 assert.equal(dispatchTaskStatusLabel("missing","unknown"),"Állapot ellenőrizendő");
});
