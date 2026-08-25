export type CountryCode="HU"|"SK";
export type CatalogItem={name:string;category:string;metadata?:Record<string,number|string>};
export const soilWork=["Tarlóhántás","Tárcsázás","Boronálás","Kultivátorozás","Sekélyszántás","Szántás","Mélyszántás","Mélylazítás","Rotálás / rotációs művelés","Hengerezés","Magágykészítés","Sorközművelés"];
export const fertilizerCatalog:CatalogItem[]=[
 {name:"Karbamid 46% N",category:"fertilizer",metadata:{N:46}},
 {name:"MAS 27% N",category:"fertilizer",metadata:{N:27}},
 {name:"DAP 18-46",category:"fertilizer",metadata:{N:18,P2O5:46}},
 {name:"MAP 11-52",category:"fertilizer",metadata:{N:11,P2O5:52}},
 {name:"NPK 15-15-15",category:"fertilizer",metadata:{N:15,P2O5:15,K2O:15}},
 {name:"NPK 8-20-30",category:"fertilizer",metadata:{N:8,P2O5:20,K2O:30}},
 {name:"Kálium-klorid / kálisó 60% K₂O",category:"fertilizer",metadata:{K2O:60}}
];
export const countries:{code:CountryCode;label:string}[]=[{code:"HU",label:"Magyarország"},{code:"SK",label:"Szlovákia"}];
export function nutrientSummary(name:string,dose:number|null){if(!dose)return"";const item=fertilizerCatalog.find(x=>x.name===name);if(!item?.metadata)return"";return Object.entries(item.metadata).filter(([,v])=>typeof v==="number").map(([k,v])=>`${k}: ${Math.round(dose*(v as number))/100} kg/ha`).join(" · ")}
