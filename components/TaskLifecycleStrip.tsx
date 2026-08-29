import {WorkFlowStatusBadge} from "@/components/WorkFlowStatusBadge";
import {taskLifecycleHint,taskWorkFlowStatus,type ExistingTaskState} from "@/lib/taskLifecycle";

export function TaskLifecycleStrip({task}:{task:ExistingTaskState}){
 const status=taskWorkFlowStatus(task);
 return <div data-help-block="task-lifecycle" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:8}}>
  <WorkFlowStatusBadge status={status}/>
  <small style={{color:"#657166"}}>{taskLifecycleHint(task)}</small>
 </div>;
}
