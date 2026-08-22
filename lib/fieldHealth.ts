import {isSupervisionActive,type SupervisionConfig} from "@/lib/supervision";

export type FieldHealthStatus="good"|"attention"|"critical"|"inactive";
export type HealthInspection={condition?:string|null;inspected_at?:string|null};
export type HealthTask={status?:string|null;due_date?:string|null;priority?:string|null};
export type HealthReport={status?:string|null;created_at?:string|null};
export type HealthHotspot={severity?:string|null;resolved?:boolean|null};
export type FieldHealth={status:FieldHealthStatus;score:number;label:string;reasons:string[];daysSinceInspection:number|null;supervisionActive:boolean};

function dayDiff(from:string,to=new Date()){const a=new Date(from);if(Number.isNaN(a.getTime()))return null;const aa=new Date(a);aa.setHours(0,0,0,0);const bb=new Date(to);bb.setHours(0,0,0,0);return Math.floor((bb.getTime()-aa.getTime())/86400000)}

export function evaluateFieldHealth({inspection,tasks=[],reports=[],hotspots=[],supervision,now=new Date()}:{inspection?:HealthInspection|null;tasks?:HealthTask[];reports?:HealthReport[];hotspots?:HealthHotspot[];supervision?:SupervisionConfig|null;now?:Date}):FieldHealth{
 const reasons:string[]=[];let score=0;let status:FieldHealthStatus="good";const supervisionActive=isSupervisionActive(supervision,now);const interval=supervision?.inspectionIntervalDays??30;
 const openTasks=tasks.filter(t=>t.status!=="done");
 const overdue=openTasks.filter(t=>t.due_date&&new Date(t.due_date).getTime()<now.getTime());
 const urgent=openTasks.filter(t=>t.priority==="urgent"||t.priority==="high");
 const openReports=reports.filter(r=>r.status!=="closed");
 const openHotspots=hotspots.filter(h=>!h.resolved),criticalHotspots=openHotspots.filter(h=>h.severity==="critical");
 const days=inspection?.inspected_at?dayDiff(inspection.inspected_at,now):null;
 if(criticalHotspots.length){status="critical";score+=120+Math.min(30,criticalHotspots.length*5);reasons.push(`${criticalHotspots.length} kritikus térképi problémagóc`)}
 if(inspection?.condition==="critical"){status="critical";score+=100;reasons.push("Kritikus szemle")}
 else if(inspection?.condition==="attention"){if(status!=="critical")status="attention";score+=55;reasons.push("A legutóbbi szemle figyelmet igényel")}
 if(openHotspots.length-criticalHotspots.length){if(status!=="critical")status="attention";score+=Math.min(45,20+(openHotspots.length-criticalHotspots.length)*5);reasons.push(`${openHotspots.length-criticalHotspots.length} nyitott térképi figyelmeztetés`)}
 if(overdue.length){if(status!=="critical")status="attention";score+=Math.min(45,25+overdue.length*5);reasons.push(`${overdue.length} lejárt teendő`)}
 if(urgent.length){if(status!=="critical")status="attention";score+=Math.min(30,15+urgent.length*4);reasons.push(`${urgent.length} magas prioritású teendő`)}
 if(openReports.length){if(status!=="critical")status="attention";score+=Math.min(30,15+openReports.length*4);reasons.push(`${openReports.length} nyitott gazdálkodói bejelentés`)}
 if(supervisionActive){
  if(!inspection){if(status!=="critical")status="attention";score+=18;reasons.push("Aktív szezonban még nem volt szemle")}
  else if(days!==null&&days>=interval){if(status!=="critical")status="attention";score+=days>=interval*2?30:18;reasons.push(`${days} napja nem volt szemle · elvárt ciklus: ${interval} nap`)}
 }else if(status==="good"){
  status="inactive";reasons.push("Szezonon kívüli szaktanácsadói időszak")
 }
 if(status==="good"&&reasons.length===0)reasons.push("Nincs nyitott szakmai figyelmeztetés");
 const label=status==="critical"?"Kritikus":status==="attention"?"Figyelmet igényel":status==="inactive"?"Szezonon kívül":"Rendben";
 return{status,score,label,reasons,daysSinceInspection:days,supervisionActive};
}
