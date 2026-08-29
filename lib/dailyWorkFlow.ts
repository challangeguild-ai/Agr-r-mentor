export type WorkFlowStatus="planned"|"assigned"|"in_progress"|"done"|"review_required"|"verified"|"rejected";
export type WorkFlowEvent="assign"|"start"|"complete"|"request_review"|"verify"|"reject"|"reopen";

const transitions:Record<WorkFlowStatus,Partial<Record<WorkFlowEvent,WorkFlowStatus>>>= {
 planned:{assign:"assigned",start:"in_progress"},
 assigned:{start:"in_progress",reopen:"planned"},
 in_progress:{complete:"done",request_review:"review_required",reopen:"planned"},
 done:{request_review:"review_required",verify:"verified",reopen:"in_progress"},
 review_required:{verify:"verified",reject:"rejected",reopen:"in_progress"},
 verified:{reopen:"in_progress"},
 rejected:{reopen:"in_progress"}
};

export function nextWorkFlowStatus(status:WorkFlowStatus,event:WorkFlowEvent){return transitions[status]?.[event]??null;}
export function canTransition(status:WorkFlowStatus,event:WorkFlowEvent){return nextWorkFlowStatus(status,event)!==null;}
export function workFlowLabel(status:WorkFlowStatus){
 const labels:Record<WorkFlowStatus,string>={planned:"Tervezett",assigned:"Kiosztva",in_progress:"Folyamatban",done:"Elvégezve",review_required:"Ellenőrzésre vár",verified:"Visszaigazolva",rejected:"Javítandó"};
 return labels[status];
}

export type ExecutionProof={completedAt?:string|null;note?:string|null;photoCount?:number;machineId?:string|null;operatorId?:string|null;materialRecorded?:boolean};
export function validateExecutionProof(proof:ExecutionProof){
 const missing:string[]=[];
 if(!proof.completedAt)missing.push("tényleges végrehajtási idő");
 if(!proof.note?.trim())missing.push("végrehajtási megjegyzés");
 if((proof.photoCount??0)<1)missing.push("legalább egy fénykép");
 return {valid:missing.length===0,missing};
}
