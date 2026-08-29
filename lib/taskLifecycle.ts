import type {WorkFlowStatus} from "@/lib/dailyWorkFlow";

export type ExistingTaskState={status:string|null;reviewStatus?:string|null;completedAt?:string|null};

/**
 * A 2.0 munkafolyamat nézeti leképezése a már működő tasks.status + review_status modellre.
 * Nem jogosultsági réteg és nem ír adatbázist; az RLS/RPC/server action marad mérvadó.
 */
export function taskWorkFlowStatus(task:ExistingTaskState):WorkFlowStatus{
 const status=task.status||"open";
 const review=task.reviewStatus||"not_required";
 if(review==="rejected")return "rejected";
 if(status==="done"||review==="approved")return "verified";
 if(status==="submitted"||review==="pending")return "review_required";
 if(status==="in_progress")return "in_progress";
 if(status==="assigned")return "assigned";
 if(task.completedAt)return "done";
 return "planned";
}

export function taskLifecycleHint(task:ExistingTaskState){
 const state=taskWorkFlowStatus(task);
 if(state==="rejected")return "Javítás szükséges a szaktanácsadói visszajelzés alapján.";
 if(state==="review_required")return "A végrehajtás beküldve, szaktanácsadói ellenőrzésre vár.";
 if(state==="verified")return "A végrehajtás ellenőrzött és visszaigazolt.";
 if(state==="in_progress")return "A munka végrehajtása folyamatban van.";
 return "A feladat végrehajtásra vár.";
}
