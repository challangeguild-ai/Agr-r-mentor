import type {DailyWorkInput} from "@/lib/dailyWorkPriority";

export type DailyAlert={id:string;level:"critical"|"warning"|"info";title:string;body:string;href:string};

export function buildDailyAlerts(items:DailyWorkInput[],today:string){
 const alerts:DailyAlert[]=[];
 for(const item of items){
  const due=item.dueAt?.slice(0,10)||null;
  if(due&&due<today){alerts.push({id:`overdue-${item.kind}-${item.id}`,level:"critical",title:"Lejárt tétel",body:item.title,href:item.fieldId?`/fields/${item.fieldId}`:"/tasks"});continue;}
  if(item.requiresApproval){alerts.push({id:`approval-${item.id}`,level:"warning",title:"Jóváhagyásra vár",body:item.title,href:"/operations/approvals"});continue;}
  if(item.unread&&item.kind==="report")alerts.push({id:`report-${item.id}`,level:"warning",title:"Új gazdálkodói jelzés",body:item.title,href:item.fieldId?`/fields/${item.fieldId}`:"/admin/reports"});
  if(item.condition==="critical")alerts.push({id:`critical-${item.id}`,level:"critical",title:"Kritikus táblaállapot",body:item.title,href:item.fieldId?`/fields/${item.fieldId}`:"/fields"});
 }
 return alerts.slice(0,12);
}
