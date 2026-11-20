export type OperationSubmissionAttempt={
 id:string;
 fingerprint:string;
 createdAt:number;
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AGE=12*60*60*1000;

export function operationSubmissionFingerprint(formData:FormData):string{
 const entries=[...formData.entries()]
  .filter(([key,value])=>key!=="request_id"&&typeof value==="string")
  .map(([key,value])=>[key,String(value)]);
 entries.sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
 return JSON.stringify(entries);
}

export function reuseOperationAttempt(
 raw:unknown,fingerprint:string,now:number,newId:()=>string
):OperationSubmissionAttempt{
 if(raw&&typeof raw==="object"){
  const prior=raw as Partial<OperationSubmissionAttempt>;
  if(typeof prior.id==="string"&&UUID.test(prior.id)&&
    prior.fingerprint===fingerprint&&typeof prior.createdAt==="number"&&
    Number.isFinite(prior.createdAt)&&now>=prior.createdAt&&now-prior.createdAt<MAX_AGE){
   return{id:prior.id,fingerprint,createdAt:prior.createdAt};
  }
 }
 return{id:newId(),fingerprint,createdAt:now};
}
