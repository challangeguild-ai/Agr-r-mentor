export type ProfitEntry={
 entry_type:"cost"|"sale";
 amount_huf?:number|string|null;
 quantity_tonnes?:number|string|null;
 price_huf_per_tonne?:number|string|null;
};

export type ProfitTotals={
 totalCost:number;
 soldTonnes:number;
 realizedRevenue:number;
 realizedResult:number;
 unsoldTonnes:number;
 estimatedUnsoldRevenue:number;
 projectedRevenue:number;
 projectedResult:number;
 costPerHa:number|null;
 projectedResultPerHa:number|null;
 breakEvenPricePerTonne:number|null;
 marginPercent:number|null;
 oversold:boolean;
};

function nonnegative(value:unknown){
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:0;
}

const huf=(value:number)=>Math.round(value);
const tonne=(value:number)=>Math.round(value*1000)/1000;

/** A realizált eredmény csak a ténylegesen eladott termény árbevételét tartalmazza. */
export function calculateProfit({harvestedTonnes,expectedPriceHufPerTonne,areaHa,entries}:{
 harvestedTonnes:number|string|null;
 expectedPriceHufPerTonne:number|string|null;
 areaHa:number|string|null;
 entries:ProfitEntry[];
}):ProfitTotals{
 let cost=0,sold=0,revenue=0;
 for(const entry of entries){
  if(entry.entry_type==="cost")cost+=nonnegative(entry.amount_huf);
  if(entry.entry_type==="sale"){
   const quantity=nonnegative(entry.quantity_tonnes);
   sold+=quantity;
   revenue+=quantity*nonnegative(entry.price_huf_per_tonne);
  }
 }
 const harvested=nonnegative(harvestedTonnes);
 const area=nonnegative(areaHa);
 const unsold=Math.max(0,harvested-sold);
 const remainingRevenue=huf(unsold*nonnegative(expectedPriceHufPerTonne));
 const realizedRevenue=huf(revenue);
 const totalCost=huf(cost);
 const projectedRevenue=realizedRevenue+remainingRevenue;
 const projectedResult=projectedRevenue-totalCost;
 return{
  totalCost,
  soldTonnes:tonne(sold),
  realizedRevenue,
  realizedResult:realizedRevenue-totalCost,
  unsoldTonnes:tonne(unsold),
  estimatedUnsoldRevenue:remainingRevenue,
  projectedRevenue,
  projectedResult,
  costPerHa:area>0?huf(totalCost/area):null,
  projectedResultPerHa:area>0?huf(projectedResult/area):null,
  breakEvenPricePerTonne:harvested>0?huf(totalCost/harvested):null,
  marginPercent:projectedRevenue>0?Math.round(projectedResult/projectedRevenue*1000)/10:null,
  oversold:sold>harvested+0.0001,
 };
}
