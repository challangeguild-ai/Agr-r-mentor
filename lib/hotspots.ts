export const HOTSPOT_EVENT="field_hotspot";
export const hotspotTypes=[
 ["weed","Gyomosodás"],["pest","Kártevő"],["disease","Betegség"],["water","Belvíz / vízkár"],["nutrient","Tápanyaghiány"],["soil","Talajprobléma"],["lodging","Dőlés / viharkár"],["other","Egyéb probléma"]
] as const;
export type HotspotType=typeof hotspotTypes[number][0];
export type HotspotSeverity="warning"|"critical";
export type HotspotData={type:HotspotType;severity:HotspotSeverity;lat:number;lng:number;notes?:string;resolved?:boolean;resolvedAt?:string|null};
export function hotspotLabel(type:string){return hotspotTypes.find(([k])=>k===type)?.[1]||"Egyéb probléma"}
export function encodeHotspot(data:HotspotData){return `HOTSPOTJSON:${JSON.stringify(data)}`}
export function decodeHotspot(value:string|null|undefined):HotspotData|null{if(!value||!value.startsWith("HOTSPOTJSON:"))return null;try{const data=JSON.parse(value.slice(12));if(!Number.isFinite(Number(data.lat))||!Number.isFinite(Number(data.lng)))return null;return data as HotspotData}catch{return null}}
export function hotspotSeverityLabel(v:string){return v==="critical"?"Kritikus":"Figyelmeztetés"}
