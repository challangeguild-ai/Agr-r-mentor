import test from "node:test";
import assert from "node:assert/strict";
import {requireOfficialPlantProtectionUse} from "../lib/operationCatalogGuard.ts";

test("forged manual pesticide names cannot bypass server permit use selection",()=>{
 assert.match(requireOfficialPlantProtectionUse("",""),/hivatalos/);
 assert.match(requireOfficialPlantProtectionUse("product-id",""),/engedélyezett/);
 assert.equal(requireOfficialPlantProtectionUse("product-id","use-id"),null);
});
