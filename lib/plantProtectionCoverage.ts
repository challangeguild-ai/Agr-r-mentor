/** The successful import of a product list does not prove its licensed uses exist. */
export function plantProtectionCoverage(products:ReadonlyArray<{id:string}>,uses:ReadonlyArray<{product_id:string}>){
 const ids=new Set(products.map(p=>p.id));
 const covered=new Set(uses.map(u=>u.product_id).filter(id=>ids.has(id)));
 const missing=ids.size-covered.size;
 const state:"unavailable"|"partial"|"ready"=!ids.size||!covered.size?"unavailable":missing?"partial":"ready";
 return{state,products:ids.size,productsWithUses:covered.size,productsWithoutUses:missing,uses:uses.length};
}

export function effectivePlantCatalogStatus(status:string|null|undefined,coverage:{state:"unavailable"|"partial"|"ready"}){
 return status==="ready"&&coverage.state!=="ready"?"stale":status??"pending";
}
