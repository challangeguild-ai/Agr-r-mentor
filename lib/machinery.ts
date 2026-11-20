export const machineTypes=[['tractor','Traktor'],['combine','Kombájn'],['sprayer','Permetező'],['implement','Munkagép'],['loader','Rakodó'],['other','Egyéb']] as const;
export type MachineType=typeof machineTypes[number][0];
export function machineTypeLabel(v:string|null|undefined){return machineTypes.find(([k])=>k===v)?.[1]||'Gép'}
export function serviceStatus(current:number|null|undefined,next:number|null|undefined){if(current==null||next==null)return{label:'Nincs szervizciklus',tone:'neutral'};const left=Number(next)-Number(current);if(left<=0)return{label:`Szerviz esedékes (${Math.abs(left).toLocaleString('hu-HU')} üó túlfutás)`,tone:'critical'};if(left<=20)return{label:`Szerviz ${left.toLocaleString('hu-HU')} üó múlva`,tone:'attention'};return{label:`Következő szerviz: ${next.toLocaleString('hu-HU')} üó`,tone:'good'}}

function machineNumber(input:FormDataEntryValue|null,label:string,decimals:number){
 if(input!==null&&typeof input!=="string")throw new Error(`Érvénytelen ${label}: szöveges szám szükséges.`);
 const raw=typeof input==="string"?input.trim().replace(",","."):"";
 if(!raw)return null;
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))throw new Error(`Érvénytelen ${label}: csak nemnegatív szám adható meg.`);
 const value=Number(raw),fraction=raw.split(".")[1]||"";
 if(!Number.isFinite(value)||value>=10**(12-decimals)||fraction.length>decimals)
  throw new Error(`Érvénytelen ${label}: túl nagy érték vagy túl sok tizedesjegy.`);
 return value;
}

export function parseMachineMeasurements(formData:Pick<FormData,"get">){
 const currentHours=machineNumber(formData.get("current_hours"),"üzemóra",1);
 const currentHectares=machineNumber(formData.get("current_hectares"),"hektárteljesítmény",2);
 const serviceIntervalHours=machineNumber(formData.get("service_interval_hours"),"szervizciklus",1);
 const nextServiceHours=machineNumber(formData.get("next_service_hours"),"következő szerviz üzemórája",1);
 if(serviceIntervalHours===0)throw new Error("A szervizciklusnak nullánál nagyobbnak kell lennie.");
 return{currentHours,currentHectares,serviceIntervalHours,nextServiceHours};
}
