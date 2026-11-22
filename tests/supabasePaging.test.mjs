import test from "node:test";
import assert from "node:assert/strict";
import {fetchAllPages,chunkIds} from "../lib/supabasePaging.ts";

test("paginates a ledger beyond the Supabase row cap without dropping rows",async()=>{
 const ledger=Array.from({length:1251},(_,i)=>({id:i}));
 const result=await fetchAllPages(async(from,to)=>({data:ledger.slice(from,to+1),error:null}),"Kimutatás",500);
 assert.deepEqual(result,ledger);
});
test("fails without displaying partial totals if a later page cannot load",async()=>{
 const ledger=Array.from({length:800},(_,i)=>({id:i}));
 await assert.rejects(fetchAllPages(async(from,to)=>from>=500?{data:null,error:{message:"Hálózati hiba"}}:{data:ledger.slice(from,to+1),error:null},"Pénzügyi adatok"),/Pénzügyi adatok.*Hálózati hiba/);
});
test("groups identifiers within safe query lengths",()=>{
 assert.deepEqual(chunkIds([1,2,3,4,5],2),[[1,2],[3,4],[5]]);
});
