export const TASK_ACCEPTED_EVENT="task_accepted";
export const TASK_STARTED_EVENT="task_started";
export type WorkerTaskStage="assigned"|"accepted"|"started"|"done";
export function workerTaskStage(status:string|null|undefined,events:{event_type?:string|null}[]):WorkerTaskStage{
 if(status==="done")return"done";
 if(events.some(e=>e.event_type===TASK_STARTED_EVENT))return"started";
 if(events.some(e=>e.event_type===TASK_ACCEPTED_EVENT))return"accepted";
 return"assigned";
}
export function workerTaskStageLabel(stage:WorkerTaskStage){return stage==="done"?"Elvégezve":stage==="started"?"Folyamatban":stage==="accepted"?"Elfogadva":"Új munka"}
