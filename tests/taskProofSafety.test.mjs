import test from "node:test";
import assert from "node:assert/strict";
import {confirmedSafeToDeleteProof} from "../lib/taskProof.ts";

test("only confirmed pre-write rejection allows deleting the uploaded proof",()=>{
 assert.equal(confirmedSafeToDeleteProof({ok:false,safeToRemoveProof:true}),true);
 assert.equal(confirmedSafeToDeleteProof({ok:false,safeToRemoveProof:false}),false);
 assert.equal(confirmedSafeToDeleteProof({ok:false}),false);
});
test("success, already submitted and unknown responses retain existing proof",()=>{
 assert.equal(confirmedSafeToDeleteProof({ok:true,safeToRemoveProof:true}),false);
 assert.equal(confirmedSafeToDeleteProof(null),false);
 assert.equal(confirmedSafeToDeleteProof(undefined),false);
});
