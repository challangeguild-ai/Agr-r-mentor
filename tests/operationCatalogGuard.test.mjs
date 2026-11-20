import test from "node:test";
import assert from "node:assert/strict";
import {validateManualPlantProtection} from "../lib/operationCatalogGuard.ts";

const base={country:"HU",hasVerifiedUses:false,productId:"",useId:"",productName:"Kijuttatott szer",crop:"Búza",dose:0.5,doseUnit:"l/ha",acknowledged:true};
test("HU actual dose can be logged manually only after permit acknowledgment",()=>{
 assert.equal(validateManualPlantProtection(base),null);
 assert.match(validateManualPlantProtection({...base,acknowledged:false}),/NÉBIH/);
 assert.match(validateManualPlantProtection({...base,dose:null}),/dózis/);
 assert.match(validateManualPlantProtection({...base,dose:-1}),/dózis/);
 assert.match(validateManualPlantProtection({...base,crop:""}),/kultúra/);
 assert.match(validateManualPlantProtection({...base,useId:"forged"}),/felhasználás/);
});
test("SK and HU with actual verified uses reject manual override",()=>{
 assert.match(validateManualPlantProtection({...base,country:"SK"}),/Hivatalos/);
 assert.match(validateManualPlantProtection({...base,hasVerifiedUses:true}),/Hivatalos/);
 assert.equal(validateManualPlantProtection({...base,productId:"official-product"}),null);
});
