export const TASK_ACCEPTED_EVENT="task_accepted";
export const TASK_STARTED_EVENT="task_started";
export const TASK_SUBMITTED_EVENT="task_submitted_review";
export const TASK_APPROVED_EVENT="task_review_approved";
export const TASK_REJECTED_EVENT="task_review_rejected";
export type WorkerTaskStage="assigned"|"accepted"|"started"|"submitted"|"done";
export function workerTaskStage(status:string|null|undefined,events:{event_type?:string|null}[]):WorkerTaskStage{
 if(status==="done")return"done";
 if(status==="submitted"||events.some(e=>e.event_type===TASK_SUBMITTED_EVENT))return"submitted";
 if(events.some(e=>e.event_type===TASK_STARTED_EVENT))return"started";
 if(events.some(e=>e.event_type===TASK_ACCEPTED_EVENT))return"accepted";
 return"assigned";
}
export function workerTaskStageLabel(stage:WorkerTaskStage){return stage==="done"?"Visszaigazolva":stage==="submitted"?"Ellenőrzésre vár":stage==="started"?"Folyamatban":stage==="accepted"?"Elfogadva":"Új munka"}
