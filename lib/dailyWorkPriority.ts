export type DailyWorkKind="task"|"inspection"|"report"|"visit"|"approval";
export type DailyWorkSeverity="critical"|"high"|"normal"|"low";

export type DailyWorkInput={
 id:string;
 kind:DailyWorkKind;
 title:string;
 dueAt?:string|null;
 createdAt?:string|null;
 priority?:string|null;
 condition?:string|null;
 status?:string|null;
 unread?:boolean;
 requiresApproval?:boolean;
 farmId?:string|null;
 fieldId?:string|null;
};

export type DailyWorkPriority=DailyWorkInput&{
 score:number;
 severity:DailyWorkSeverity;
 reasons:string[];
 overdue:boolean;
 dueToday:boolean;
};

function dayKey(value:Date|string){
 const d=typeof value==="string"?new Date(value):value;
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}

function validDate(value:string|null|undefined){
 if(!value)return null;
 const d=new Date(value);
 return Number.isNaN(d.getTime())?null:d;
}

export function scoreDailyWork(input:DailyWorkInput,now=new Date()):DailyWorkPriority{
 let score=0;
 const reasons:string[]=[];
 const today=dayKey(now);
 const due=validDate(input.dueAt);
 const dueKey=due?dayKey(due):null;
 const overdue=!!dueKey&&dueKey<today;
 const dueToday=dueKey===today;

 if(overdue){score+=50;reasons.push("Lejárt határidő");}
 else if(dueToday){score+=35;reasons.push("Ma esedékes");}
 else if(due){
  const diff=Math.ceil((due.getTime()-now.getTime())/86400000);
  if(diff<=2){score+=22;reasons.push("48 órán belül esedékes");}
  else if(diff<=7){score+=10;reasons.push("7 napon belül esedékes");}
 }

 const p=String(input.priority||"").toLowerCase();
 if(p==="urgent"||p==="critical"){score+=35;reasons.push("Kritikus prioritás");}
 else if(p==="high"){score+=22;reasons.push("Magas prioritás");}
 else if(p==="low")score-=5;

 if(input.condition==="critical"){score+=40;reasons.push("Kritikus táblaállapot");}
 if(input.unread){score+=18;reasons.push("Új, még nem kezelt jelzés");}
 if(input.requiresApproval){score+=20;reasons.push("Jóváhagyásra vár");}
 if(input.kind==="inspection"&&overdue){score+=12;reasons.push("Elmaradt visszaellenőrzés");}
 if(input.kind==="report"){score+=8;reasons.push("Gazdálkodói jelzés");}

 const scoreBounded=Math.max(0,score);
 const severity:DailyWorkSeverity=scoreBounded>=75?"critical":scoreBounded>=45?"high":scoreBounded>=20?"normal":"low";
 return {...input,score:scoreBounded,severity,reasons,overdue,dueToday};
}

export function prioritizeDailyWork(items:DailyWorkInput[],now=new Date()){
 return items.map(item=>scoreDailyWork(item,now)).sort((a,b)=>b.score-a.score||String(a.dueAt||"").localeCompare(String(b.dueAt||""))||a.title.localeCompare(b.title,"hu"));
}

export function dailyWorkSeverityLabel(severity:DailyWorkSeverity){
 return severity==="critical"?"Azonnali":severity==="high"?"Magas":severity==="normal"?"Normál":"Alacsony";
}
