import test from "node:test";
import assert from "node:assert/strict";
import {productUseBlockingReason} from "../lib/productUseStatus.ts";

test("a NÉBIH unknown status is blocked, including with a selected product ID",()=>{
 assert.match(productUseBlockingReason({country:"HU",operationDate:"2026-11-20",active:true,regulatoryStatus:"unknown"}),/nincs igazolva/);
});
test("confirmed Hungarian grace end and expiry are applied to the operation date",()=>{
 assert.equal(productUseBlockingReason({country:"HU",operationDate:"2026-11-20",active:true,regulatoryStatus:"withdrawn_grace",validUntil:"2026-11-01",gracePeriodUntil:"2026-11-21"}),null);
 assert.match(productUseBlockingReason({country:"HU",operationDate:"2026-11-22",active:true,regulatoryStatus:"withdrawn_grace",gracePeriodUntil:"2026-11-21"}),/lejárt/);
});
