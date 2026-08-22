export const SUPERVISION_EVENT="supervision_config";

export type SupervisionConfig={
  activeFrom:string;
  activeTo:string;
  inspectionIntervalDays:number;
  enabled:boolean;
  note?:string;
};

export const defaultSupervisionConfig:SupervisionConfig={activeFrom:"03-15",activeTo:"10-31",inspectionIntervalDays:30,enabled:true};

export function encodeSupervisionConfig(config:SupervisionConfig){return `SUPERVISION:${JSON.stringify(config)}`}
export function decodeSupervisionConfig(value:string|null|undefined):SupervisionConfig|null{
 if(!value?.startsWith("SUPERVISION:"))return null;
 try{const x=JSON.parse(value.slice(12));if(!x||typeof x!=="object")return null;return{activeFrom:String(x.activeFrom||"03-15"),activeTo:String(x.activeTo||"10-31"),inspectionIntervalDays:Math.max(1,Math.min(365,Number(x.inspectionIntervalDays)||30)),enabled:x.enabled!==false,note:x.note?String(x.note):undefined}}catch{return null}
}

function md(date:Date){return `${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
export function isSupervisionActive(config:SupervisionConfig|null|undefined,now=new Date()){
 const c=config??defaultSupervisionConfig;if(!c.enabled)return false;const today=md(now);const start=c.activeFrom,end=c.activeTo;
 return start<=end?today>=start&&today<=end:today>=start||today<=end;
}

export function supervisionLabel(config:SupervisionConfig|null|undefined){const c=config??defaultSupervisionConfig;return c.enabled?`${c.activeFrom.replace("-",".")}–${c.activeTo.replace("-",".")} · ${c.inspectionIntervalDays} napos szemleciklus`:"Automatikus szemleciklus kikapcsolva"}
