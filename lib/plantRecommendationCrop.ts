/** Match a field's crop only to a real option in the official catalog. */
export function normalizeCatalogCrop(value:string):string{
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("hu-HU").replace(/\s+/g," ").trim();
}

export function matchingCatalogCrop(fieldCrop:string|null|undefined,options:string[]):string{
 if(!fieldCrop?.trim())return "";
 const normalized=normalizeCatalogCrop(fieldCrop);
 return options.find(crop=>normalizeCatalogCrop(crop)===normalized)??"";
}
