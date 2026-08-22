export const ADVISOR_VISIT_EVENT="advisor_visit_plan";

export type AdvisorVisitStatus="planned"|"completed"|"cancelled";
export type AdvisorVisit={
  scheduledAt:string;
  purpose:string;
  note?:string;
  status:AdvisorVisitStatus;
  completedAt?:string|null;
};

export function encodeAdvisorVisit(v:AdvisorVisit){return `ADVISORVISIT:${JSON.stringify(v)}`}
export function decodeAdvisorVisit(value:string|null|undefined):AdvisorVisit|null{
  if(!value?.startsWith("ADVISORVISIT:"))return null;
  try{
    const x=JSON.parse(value.slice(13));
    if(!x||typeof x!=="object"||!x.scheduledAt)return null;
    const status:[AdvisorVisitStatus,...AdvisorVisitStatus[]]=["planned","completed","cancelled"];
    return{
      scheduledAt:String(x.scheduledAt),
      purpose:String(x.purpose||"Helyszíni szaktanácsadás"),
      note:x.note?String(x.note):undefined,
      status:status.includes(x.status)?x.status:"planned",
      completedAt:x.completedAt?String(x.completedAt):null,
    };
  }catch{return null}
}

export function advisorVisitStatusLabel(v:AdvisorVisitStatus){
  if(v==="completed")return"Elvégezve";
  if(v==="cancelled")return"Lemondva";
  return"Tervezve";
}
