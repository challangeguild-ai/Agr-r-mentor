import test from "node:test";
import assert from "node:assert/strict";
import {plantProtectionCoverage,effectivePlantCatalogStatus} from "../lib/plantProtectionCoverage.ts";

test("a NÉBIH product-only import cannot masquerade as ready",()=>{
 const state=plantProtectionCoverage([{id:"hu1"},{id:"hu2"}],[]);
 assert.equal(state.state,"unavailable");
 assert.equal(state.productsWithoutUses,2);
 assert.equal(effectivePlantCatalogStatus("ready",state),"stale");
});
test("a partial import is distinguished from verified use coverage",()=>{
 const products=[{id:"a"},{id:"b"}];
 const partial=plantProtectionCoverage(products,[{product_id:"a"},{product_id:"foreign"}]);
 assert.equal(partial.productsWithUses,1);
 assert.equal(partial.state,"partial");
 assert.equal(plantProtectionCoverage(products,[{product_id:"a"},{product_id:"b"}]).state,"ready");
});
