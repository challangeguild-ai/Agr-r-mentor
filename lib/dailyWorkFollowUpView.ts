import {buildFollowUp,type FollowUpSource} from "@/lib/dailyWorkFollowUp";

export type FollowUpCandidate={id:string;source:FollowUpSource;title:string;completedAt?:string|null;condition?:string|null;fieldId?:string|null};
export type FollowUpSuggestion={id:string;title:string;dueAt:string;priority:"high"|"normal";fieldId?:string|null;source:FollowUpSource};

/** Nézeti javaslat. Nem ír adatbázist, nem hoz létre automatikusan teendőt. */
export function buildFollowUpSuggestions(items:FollowUpCandidate[],now=new Date()):FollowUpSuggestion[]{
 return items.flatMap(item=>{
  if(!item.completedAt)return[];
  const rule=buildFollowUp({source:item.source,condition:item.condition||undefined,completedAt:item.completedAt},now);
  if(!rule)return[];
  return[{id:`${item.source}:${item.id}`,title:rule.title||`Utánkövetés: ${item.title}`,dueAt:rule.dueAt,priority:rule.priority,fieldId:item.fieldId,source:item.source}];
 }).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}
