export const OP_EVENT="field_operation";

export const operationTypes=[
  ["spraying","Permetezés"],
  ["fertilizing","Tápanyag-utánpótlás"],
  ["sowing","Vetés"],
  ["soil_work","Talajmunka"],
  ["harvest","Betakarítás"],
  ["irrigation","Öntözés"],
  ["mowing","Kaszálás"],
  ["plant_protection","Növényvédelem"],
  ["other","Egyéb művelet"],
] as const;

export type OperationType=typeof operationTypes[number][0];

export type OperationData={
  type:OperationType;
  countryCode?:"HU"|"SK";
  subtype?:string;
  product?:string;
  productId?:string;
  authorizationNumber?:string;
  crop?:string;
  target?:string;
  useId?:string;
  activeIngredient?:string;
  composition?:string;
  dose?:number|null;
  doseUnit?:string;
  quantity?:number|null;
  quantityUnit?:string;
  treatedArea?:number|null;
  machine?:string;
  weather?:string;
  notes?:string;
  operator?:string;
};

export function operationLabel(type:string){
  return operationTypes.find(([k])=>k===type)?.[1]||"Gazdálkodási művelet";
}

export function encodeOperation(data:OperationData){
  return `OPJSON:${JSON.stringify(data)}`;
}

export function decodeOperation(value:string|null|undefined):OperationData|null{
  if(!value)return null;
  if(value.startsWith("OPJSON:")){
    try{return JSON.parse(value.slice(7)) as OperationData}catch{return null}
  }
  const chunks=value.split(" | ").map(x=>x.trim());
  const read=(label:string)=>chunks.find(x=>x.startsWith(`${label}: `))?.slice(label.length+2).trim();
  const label=read("Típus");
  const type=operationTypes.find(([,l])=>l===label)?.[0];
  if(!type)return null;
  const parseNum=(v:string|undefined)=>{
    if(!v)return null;
    const n=Number(v.replace(",",".").match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(n)?n:null;
  };
  const doseRaw=read("Dózis"),quantityRaw=read("Mennyiség"),areaRaw=read("Kezelt terület");
  const unitAfterNumber=(v:string|undefined)=>v?.replace(/^\s*-?\d+(?:[.,]\d+)?\s*/,"").trim()||undefined;
  return {
    type,
    product:read("Anyag"),
    dose:parseNum(doseRaw),
    doseUnit:unitAfterNumber(doseRaw),
    quantity:parseNum(quantityRaw),
    quantityUnit:unitAfterNumber(quantityRaw),
    treatedArea:parseNum(areaRaw),
    machine:read("Gép"),
    operator:read("Végrehajtó"),
    weather:read("Körülmények"),
    notes:read("Megjegyzés"),
  };
}

export function operationSummary(data:OperationData){
  const parts=[operationLabel(data.type)];
  if(data.subtype)parts.push(data.subtype);
  if(data.crop)parts.push(data.crop);
  if(data.product)parts.push(data.product);
  if(data.dose!=null)parts.push(`${data.dose} ${data.doseUnit||""}`.trim());
  if(data.treatedArea!=null)parts.push(`${data.treatedArea} ha`);
  return parts.join(" · ");
}
