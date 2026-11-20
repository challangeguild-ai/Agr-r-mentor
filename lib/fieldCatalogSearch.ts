type SearchableField={name:string;current_crop:string|null;farmName?:string|null};

function normalize(text:string){
 return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("hu-HU");
}

export function matchesFieldCatalogQuery(field:SearchableField,query:string){
 const terms=normalize(query.trim()).split(/\s+/).filter(Boolean);
 if(!terms.length)return true;
 const searchable=normalize([field.name,field.current_crop,field.farmName].filter(Boolean).join(" "));
 return terms.every(term=>searchable.includes(term));
}
