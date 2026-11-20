import test from "node:test";
import assert from "node:assert/strict";
import {plantProtectionCoverage,effectivePlantCatalogStatus} from "../lib/plantProtectionCoverage.ts";

test("import-ready status never hides a missing Hungarian permit-use dataset",()=>{
 const state=plantProtectionCoverage([{id:"hu-1"},{id:"hu-2"}],[]);
 assert.deepEqual(state,{state:"unavailable",products:2,productsWithUses:0,productsWithoutUses:2,uses:0});
 assert.equal(effectivePlantCatalogStatus("ready",state),"stale");
});
test("partial and complete coverage remain distinguishable",()=>{
 const products=[{id:"1"},{id:"2"}];
 const partial=plantProtectionCoverage(products,[{product_id:"1"},{product_id:"other"}]);
 assert.equal(partial.state,"partial");
 assert.equal(partial.productsWithUses,1);
 assert.equal(effectivePlantCatalogStatus("ready",partial),"stale");
 assert.equal(plantProtectionCoverage(products,[{product_id:"1"},{product_id:"2"}]).state,"ready");
});
