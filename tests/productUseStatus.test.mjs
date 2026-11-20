import test from "node:test";
import assert from "node:assert/strict";
import {productUseBlockingReason} from "../lib/productUseStatus.ts";
const base={country:"HU",operationDate:"2026-11-18",active:true,regulatoryStatus:"authorized"};
test("active and valid authorized Hungarian products are not blocked",()=>{
 assert.equal(productUseBlockingReason({...base,validUntil:"2027-02-01"}),null);
});
test("withdrawn products are allowed only within a documented use grace period",()=>{
 const a={...base,regulatoryStatus:"withdrawn_grace",validUntil:"2025-12-31",gracePeriodUntil:"2027-03-31"};
 assert.equal(productUseBlockingReason(a),null);
 assert.match(productUseBlockingReason({...a,operationDate:"2027-04-01"}),/lejárt/);
 assert.match(productUseBlockingReason({...a,gracePeriodUntil:null}),/nem igazolt/);
});
test("unknown and non-applicable products are blocked after grace",()=>{
 assert.match(productUseBlockingReason({...base,regulatoryStatus:"unknown"}),/nincs igazolva/);
 assert.match(productUseBlockingReason({...base,regulatoryStatus:"not_applicable"}),/nem alkalmazható/);
 assert.equal(productUseBlockingReason({...base,regulatoryStatus:"not_applicable",gracePeriodUntil:"2026-11-18"}),null);
});
test("inactive and expired products are blocked; Slovak expiry works without HU status",()=>{
 assert.match(productUseBlockingReason({...base,active:false}),/nem aktív/);
 assert.match(productUseBlockingReason({...base,validFrom:"2027-01-01"}),/még nem/);
 assert.match(productUseBlockingReason({...base,validUntil:"2025-12-31"}),/lejárt/);
 assert.match(productUseBlockingReason({country:"SK",operationDate:"2026-11-18",active:true,validUntil:"2025-12-31"}),/lejárt/);
});
