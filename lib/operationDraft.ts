export type OperationDraft={
 savedAt:number;fieldId:string;type:string;step:number;
 product:string;customProduct:string;productId:string;useId:string;catalogCrop:string;dose:string;
 doseMode:"custom"|"official_max";machineId:string;customMachine:string;entries:Record<string,string>;
};

type DraftContext={
 fieldIds:readonly string[];
 operationTypes:readonly string[];
 defaultFieldId?:string;
 now?:number;
 maxAgeMs?:number;
};

/** sessionStorage is untrusted: restore only a valid, recent, authorized-looking snapshot.
 * The server always rechecks real permissions and regulatory data at submission.
 */
export function parseOperationDraft(raw:string|null,ctx:DraftContext):OperationDraft|null{
 if(!raw)return null;
 try{
  const o:unknown=JSON.parse(raw);
  if(!o||typeof o!=="object"||Array.isArray(o))return null;
  const d=o as Record<string,unknown>;
  const now=ctx.now??Date.now(),ttl=ctx.maxAgeMs??12*60*60*1000;
  if(typeof d.savedAt!=="number"||!Number.isFinite(d.savedAt)
    ||d.savedAt>now+60000||now-d.savedAt>ttl)return null;
  if(typeof d.fieldId!=="string"||!ctx.fieldIds.includes(d.fieldId)
    ||(ctx.defaultFieldId&&ctx.defaultFieldId!==d.fieldId))return null;
  if(typeof d.type!=="string"||!ctx.operationTypes.includes(d.type))return null;
  if(typeof d.step!=="number"||!Number.isInteger(d.step)||d.step<0||d.step>3)return null;
  const fields=["product","customProduct","productId","useId","catalogCrop","dose",
   "machineId","customMachine"] as const;
  for(const k of fields)if(typeof d[k]!=="string"||(d[k] as string).length>300)return null;
  if(d.doseMode!=="custom"&&d.doseMode!=="official_max")return null;
  if(!d.entries||typeof d.entries!=="object"||Array.isArray(d.entries))return null;
  const entries=d.entries as Record<string,unknown>;
  if(Object.keys(entries).length>80)return null;
  for(const [k,v] of Object.entries(entries)){
   if(k.length>80||typeof v!=="string"||v.length>5000)return null;
  }
  return d as OperationDraft;
 }catch{return null;}
}
