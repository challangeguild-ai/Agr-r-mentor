export type FieldHealthStatus="good"|"attention"|"critical";
export type HealthInspection={condition?:string|null;inspected_at?:string|null};
export type HealthTask={status?:string|null;due_date?:string|null;priority?:string|null};
export type HealthReport={status?:string|null;created_at?:string|null};
export type FieldHealth={status:FieldHealthStatus;score:number;label:string;reasons:string[];daysSinceInspection:number|null};

function dayDiff(from:string,to=new Date()){const a=new Date(from);if(Number.isNaN(a.getTime()))return null;const aa=new Date(a);aa.setHours(0,0,0,0);const bb=new Date(to);bb.setHours(0,0,0,0);return Math.floor((bb.getTime()-aa.getTime())/86400000)}

export function evaluateFieldHealth({inspection,tasks=[],reports=[],now=new Date()}:{inspection?:HealthInspection|null;tasks?:HealthTask[];reports?:HealthReport[];now?:Date}):FieldHealth{
 const reasons:string[]=[];let score=0;let status:FieldHealthStatus="good";
 const openTasks=tasks.filter(t=>t.status!=="done");
 const overdue=openTasks.filter(t=>t.due_date&&new Date(t.due_date).getTime()<now.getTime());
 const urgent=openTasks.filter(t=>t.priority==="urgent"||t.priority==="high");
 const openReports=reports.filter(r=>r.status!=="closed");
 const days=inspection?.inspected_at?dayDiff(inspection.inspected_at,now):null;
 if(inspection?.condition==="critical"){status="critical";score+=100;reasons.push("Kritikus szemle")}
 else if(inspection?.condition==="attention"){status="attention";score+=55;reasons.push("A legutóbbi szemle figyelmet igényel")}
 if(overdue.length){if(status!=="critical")status="attention";score+=Math.min(45,25+overdue.length*5);reasons.push(`${overdue.length} lejárt teendő`)}
 if(urgent.length){if(status!=="critical")status="attention";score+=Math.min(30,15+urgent.length*4);reasons.push(`${urgent.length} magas prioritású teendő`)}
 if(openReports.length){if(status!=="critical")status="attention";score+=Math.min(30,15+openReports.length*4);reasons.push(`${openReports.length} nyitott gazdálkodói bejelentés`)}
 if(!inspection){if(status!=="critical")status="attention";score+=18;reasons.push("Még nem volt helyszíni szemle")}
 else if(days!==null&&days>=45){if(status!=="critical")status="attention";score+=days>=90?30:18;reasons.push(`${days} napja nem volt szemle`)}
 if(status==="good"&&reasons.length===0)reasons.push("Nincs nyitott szakmai figyelmeztetés");
 return{status,score,label:status==="critical"?"Kritikus":status==="attention"?"Figyelmet igényel":"Rendben",reasons,daysSinceInspection:days};
}
