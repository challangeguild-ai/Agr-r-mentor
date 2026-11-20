import test from "node:test";
import assert from "node:assert/strict";
import {validateSprayingProductSelection} from "../lib/operationCatalogGuard.ts";

test("forged manual entry cannot bypass an available official pesticide catalogue",()=>{
 assert.match(validateSprayingProductSelection(true,"","Egyéb készítmény"),/hivatalos/);
 assert.match(validateSprayingProductSelection(true,"",""),/hivatalos/);
 assert.equal(validateSprayingProductSelection(true,"official-product-id",""),null);
});
test("manual pesticide names cannot bypass even an unavailable official catalogue",()=>{
 assert.match(validateSprayingProductSelection(false,"","Helyszíni kézi rögzítés"),/nem rögzíthető/);
 assert.match(validateSprayingProductSelection(false,"","   "),/nem rögzíthető/);
});
