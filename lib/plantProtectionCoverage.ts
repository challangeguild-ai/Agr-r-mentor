/** Derived from actual product/use rows, never from an import job's success flag. */
export function plantProtectionCoverage(
 products:ReadonlyArray<{id:string}>,
 uses:ReadonlyArray<{product_id:string}>
){
 const ids=new Set(products.map(p=>p.id));
 const covered=new Set(uses.map(u=>u.product_id).filter(id=>ids.has(id)));
 const missingProducts=ids.size-covered.size;
 const state: "unavailable"|"partial"|"ready" = !ids.size||!covered.size
  ? "unavailable" : missingProducts ? "partial" : "ready";
 return {state,products:ids.size,productsWithUses:covered.size,productsWithoutUses:missingProducts,uses:uses.length};
}

export function effectivePlantCatalogStatus(status:string|undefined|null,coverage:{state:"unavailable"|"partial"|"ready"}){
 return status==="ready"&&coverage.state!=="ready"?"stale":status??"pending";
}
