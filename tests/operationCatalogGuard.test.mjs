import test from "node:test";
import assert from "node:assert/strict";
import {validateSprayingProductSelection} from "../lib/operationCatalogGuard.ts";

test("forged manual entry cannot bypass an available official pesticide catalogue",()=>{
 assert.match(validateSprayingProductSelection(true,"","Egyéb készítmény"),/hivatalos/);
 assert.match(validateSprayingProductSelection(true,"",""),/hivatalos/);
 assert.equal(validateSprayingProductSelection(true,"official-product-id",""),null);
});
test("manual product names are only accepted when no official catalogue products exist",()=>{
 assert.equal(validateSprayingProductSelection(false,"","Helyszíni kézi rögzítés"),null);
 assert.match(validateSprayingProductSelection(false,"","   "),/készítményt/);
});
