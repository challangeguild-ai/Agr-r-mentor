import test from "node:test";
import assert from "node:assert/strict";
import {parseDecimalOrNull,validDateOnly} from "../lib/operationInput.ts";

test("accepts real calendar dates including leap day",()=>{
 assert.equal(validDateOnly("2028-02-29"),true);
 assert.equal(validDateOnly("2026-11-18"),true);
});
test("rejects impossible or malformed calendar dates",()=>{
 for(const value of ["2026-02-29","2026-02-30","2026-13-01","2026-11-31","2026-5-04",""]){
  assert.equal(validDateOnly(value),false,value);
 }
});
test("accepts comma and dot decimals while preserving negative values for range checks",()=>{
 assert.equal(parseDecimalOrNull(" 12,4 "),12.4);
 assert.equal(parseDecimalOrNull("12.4"),12.4);
 assert.equal(parseDecimalOrNull("-1"),-1);
 assert.equal(parseDecimalOrNull(""),null);
});
test("rejects malformed numeric input rather than silently dropping it",()=>{
 for(const value of ["12 kg","1,2,3","1e3","NaN","Infinity","1.2.3"]){
  assert.throws(()=>parseDecimalOrNull(value),/Érvénytelen számérték/,value);
 }
});
