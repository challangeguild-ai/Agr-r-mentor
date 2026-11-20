import test from "node:test";
import assert from "node:assert/strict";
import {confirmedSafeToDeleteProof,submittedProofOutcome,encodeTaskProof} from "../lib/taskProof.ts";

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

const storedProof=encodeTaskProof({lat:47.5,lng:19.1,accuracy:10,photoPath:"owner/task-proofs/task/photo-1.jpg",photoName:"photo-1.jpg",capturedAt:"2026-11-19T08:00:00.000Z",validation:"inside_boundary"});

test("a retry must never delete the photo already referenced by a submitted task",()=>{
 assert.equal(submittedProofOutcome("submitted",storedProof,"owner/task-proofs/task/photo-1.jpg"),"stored_this_photo");
 assert.equal(submittedProofOutcome("done",storedProof,"owner/task-proofs/task/photo-1.jpg"),"stored_this_photo");
});

test("a separately uploaded duplicate can be removed only after a different stored proof is confirmed",()=>{
 assert.equal(submittedProofOutcome("submitted",storedProof,"owner/task-proofs/task/photo-2.jpg"),"stored_other_photo");
 assert.equal(submittedProofOutcome("done",storedProof,"owner/task-proofs/task/photo-2.jpg"),"stored_other_photo");
});

test("missing, unreadable or unsubmitted records never authorize photo deletion",()=>{
 for(const status of ["open","started","cancelled",null]){
  assert.equal(submittedProofOutcome(status,storedProof,"owner/task-proofs/task/photo-2.jpg"),"unconfirmed");
 }
 for(const proof of [null,"", "TASKPROOF:{broken", "TASKPROOF:{}"]){
  assert.equal(submittedProofOutcome("submitted",proof,"owner/task-proofs/task/photo-2.jpg"),"unconfirmed");
 }
 assert.equal(submittedProofOutcome("submitted",storedProof,""),"unconfirmed");
});
