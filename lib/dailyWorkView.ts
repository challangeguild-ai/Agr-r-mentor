import type {DailyWorkInput} from "@/lib/dailyWorkPriority";

export type TaskLike={id:string;title:string;due_date?:string|null;priority?:string|null;status?:string|null;farm_id?:string|null;field_id?:string|null};
export type InspectionLike={id:string;field_id?:string|null;next_check_at?:string|null;condition?:string|null;issue_status?:string|null;recommendation?:string|null};
export type ReportLike={id:string;title:string;created_at?:string|null;status?:string|null;field_id?:string|null};

export function taskToDailyWork(task:TaskLike):DailyWorkInput{return {id:task.id,kind:"task",title:task.title,dueAt:task.due_date,priority:task.priority,status:task.status,farmId:task.farm_id,fieldId:task.field_id};}
export function inspectionToDailyWork(inspection:InspectionLike,fieldName?:string|null):DailyWorkInput{return {id:inspection.id,kind:"inspection",title:`Visszaellenőrzés${fieldName?` – ${fieldName}`:""}`,dueAt:inspection.next_check_at,condition:inspection.condition,status:inspection.issue_status,fieldId:inspection.field_id};}
export function reportToDailyWork(report:ReportLike):DailyWorkInput{return {id:report.id,kind:"report",title:report.title,createdAt:report.created_at,status:report.status,unread:report.status==="new"||report.status==="open",fieldId:report.field_id};}
