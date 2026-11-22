import test from "node:test";
import assert from "node:assert/strict";
import {calculateProfit} from "../lib/profitMath.ts";

test("realized income excludes unharvested or unsold crop",()=>{
 const summary=calculateProfit({harvestedTonnes:10,expectedPriceHufPerTonne:80000,areaHa:2,entries:[
  {entry_type:"cost",amount_huf:350000},
  {entry_type:"cost",amount_huf:50000},
  {entry_type:"sale",quantity_tonnes:4,price_huf_per_tonne:90000},
 ]});
 assert.equal(summary.totalCost,400000);
 assert.equal(summary.realizedRevenue,360000);
 assert.equal(summary.realizedResult,-40000);
 assert.equal(summary.unsoldTonnes,6);
 assert.equal(summary.estimatedUnsoldRevenue,480000);
 assert.equal(summary.projectedResult,440000);
 assert.equal(summary.costPerHa,200000);
 assert.equal(summary.projectedResultPerHa,220000);
 assert.equal(summary.breakEvenPricePerTonne,40000);
 assert.equal(summary.oversold,false);
});

test("no harvest cannot generate a fictional break-even price or margin",()=>{
 const summary=calculateProfit({harvestedTonnes:0,expectedPriceHufPerTonne:90000,areaHa:0,entries:[
  {entry_type:"cost",amount_huf:25000},
 ]});
 assert.equal(summary.realizedResult,-25000);
 assert.equal(summary.projectedResult,-25000);
 assert.equal(summary.breakEvenPricePerTonne,null);
 assert.equal(summary.projectedResultPerHa,null);
 assert.equal(summary.marginPercent,null);
});

test("quantity mismatch is surfaced rather than silently hiding excess sales",()=>{
 const summary=calculateProfit({harvestedTonnes:1,expectedPriceHufPerTonne:100000,areaHa:1,entries:[
  {entry_type:"sale",quantity_tonnes:2,price_huf_per_tonne:50000},
 ]});
 assert.equal(summary.oversold,true);
 assert.equal(summary.soldTonnes,2);
 assert.equal(summary.unsoldTonnes,0);
 assert.equal(summary.realizedRevenue,100000);
});

test("invalid values cannot produce NaN or negative sales and expenses",()=>{
 const summary=calculateProfit({harvestedTonnes:"bad",expectedPriceHufPerTonne:-2,areaHa:null,entries:[
  {entry_type:"cost",amount_huf:"not a number"},
  {entry_type:"sale",quantity_tonnes:-3,price_huf_per_tonne:100},
 ]});
 assert.equal(summary.projectedResult,0);
 assert.equal(summary.costPerHa,null);
});
