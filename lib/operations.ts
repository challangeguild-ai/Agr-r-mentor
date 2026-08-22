export const OP_EVENT="field_operation";
export const operationTypes=[
 ["spraying","Permetezés"],["fertilizing","Tápanyag-utánpótlás"],["sowing","Vetés"],["soil_work","Talajmunka"],["harvest","Betakarítás"],["irrigation","Öntözés"],["mowing","Kaszálás"],["plant_protection","Növényvédelem"],["other","Egyéb művelet"]
] as const;
export type OperationType=typeof operationTypes[number][0];
export type OperationData={type:OperationType;product?:string;dose?:number|null;doseUnit?:string;quantity?:number|null;quantityUnit?:string;treatedArea?:number|null;machine?:string;weather?:string;notes?:string;operator?:string};
export function operationLabel(type:string){return operationTypes.find(([k])=>k===type)?.[1]||"Gazdálkodási művelet"}
export function encodeOperation(data:OperationData){return `OPJSON:${JSON.stringify(data)}`}
export function decodeOperation(value:string|null|undefined):OperationData|null{if(!value?.startsWith("OPJSON:"))return null;try{return JSON.parse(value.slice(7)) as OperationData}catch{return null}}
export function operationSummary(data:OperationData){const parts=[operationLabel(data.type)];if(data.product)parts.push(data.product);if(data.dose)parts.push(`${data.dose} ${data.doseUnit||""}`.trim());if(data.treatedArea)parts.push(`${data.treatedArea} ha`);return parts.join(" · ")}
