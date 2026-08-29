import {workFlowLabel,type WorkFlowStatus} from "@/lib/dailyWorkFlow";

export function WorkFlowStatusBadge({status}:{status:WorkFlowStatus}){
 return <span className="user-pill" data-workflow-status={status}>{workFlowLabel(status)}</span>;
}
