import {buildFollowUp,type FollowUpSource} from "@/lib/dailyWorkFollowUp";

export type FollowUpCandidate={id:string;source:FollowUpSource;title:string;completedAt?:string|null;condition?:string|null;fieldId?:string|null;fieldName?:string|null};
export type FollowUpSuggestion={id:string;title:string;dueAt:string;priority:"urgent"|"high"|"normal";fieldId?:string|null;source:FollowUpSource};

/** Nézeti javaslat. Nem ír adatbázist, nem hoz létre automatikusan teendőt. */
export function buildFollowUpSuggestions(items:FollowUpCandidate[]):FollowUpSuggestion[]{
 return items.flatMap(item=>{
  if(!item.completedAt)return[];
  const baseDate=new Date(item.completedAt);if(Number.isNaN(baseDate.getTime()))return[];
  const rule=buildFollowUp(item.source,baseDate,{condition:item.condition,fieldName:item.fieldName});
  if(!rule)return[];
  return[{id:`${item.source}:${item.id}`,title:rule.title||`Utánkövetés: ${item.title}`,dueAt:rule.dueDate,priority:rule.priority,fieldId:item.fieldId,source:item.source}];
 }).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}
