export type FollowUpSource="inspection"|"task"|"report"|"operation";
export type FollowUpRule={source:FollowUpSource;days:number;title:string;priority:"normal"|"high"|"urgent";condition?:string};

export const DEFAULT_FOLLOW_UP_RULES:FollowUpRule[]=[
 {source:"inspection",days:7,title:"Szemle visszaellenőrzése",priority:"high",condition:"critical"},
 {source:"inspection",days:14,title:"Szemle szakmai utánkövetése",priority:"normal"},
 {source:"report",days:2,title:"Gazdálkodói jelzés utánkövetése",priority:"high"},
 {source:"operation",days:3,title:"Művelet végrehajtásának ellenőrzése",priority:"normal"}
];

export function addCalendarDays(date:Date,days:number){const next=new Date(date);next.setDate(next.getDate()+days);return next;}
export function toBudapestDateKey(date:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}

export function chooseFollowUpRule(source:FollowUpSource,condition?:string|null){
 const exact=DEFAULT_FOLLOW_UP_RULES.find(rule=>rule.source===source&&rule.condition&&rule.condition===condition);
 return exact??DEFAULT_FOLLOW_UP_RULES.find(rule=>rule.source===source&&!rule.condition)??null;
}

export function buildFollowUp(source:FollowUpSource,baseDate:Date,context:{condition?:string|null;fieldName?:string|null}){
 const rule=chooseFollowUpRule(source,context.condition);if(!rule)return null;
 return {title:context.fieldName?`${rule.title} – ${context.fieldName}`:rule.title,dueDate:toBudapestDateKey(addCalendarDays(baseDate,rule.days)),priority:rule.priority};
}
