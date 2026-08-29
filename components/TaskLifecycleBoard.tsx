import Link from "next/link";
import {TaskLifecycleStrip} from "@/components/TaskLifecycleStrip";
import {taskWorkFlowStatus,type ExistingTaskState} from "@/lib/taskLifecycle";

export type LifecycleTask=ExistingTaskState&{id:string;title:string;fieldId?:string|null;dueDate?:string|null};

function order(task:LifecycleTask){const s=taskWorkFlowStatus(task);return s==="rejected"?0:s==="review_required"?1:s==="in_progress"?2:s==="assigned"?3:s==="planned"?4:s==="done"?5:6}

export function TaskLifecycleBoard({tasks,scope}:{tasks:LifecycleTask[];scope:"farmer"|"advisor"}){
 const visible=[...tasks].sort((a,b)=>order(a)-order(b)||String(a.dueDate||"").localeCompare(String(b.dueDate||""))).slice(0,10);
 if(!visible.length)return null;
 const review=tasks.filter(t=>taskWorkFlowStatus(t)==="review_required").length,rejected=tasks.filter(t=>taskWorkFlowStatus(t)==="rejected").length;
 return <section className="panel" data-help-block="task-lifecycle-board">
  <div className="panel-heading"><div><span className="eyebrow">VÉGREHAJTÁSI ÉLETCIKLUS</span><h2>Terv → végrehajtás → ellenőrzés</h2><p>A napi munkák állapota a már működő feladat- és végrehajtási adatokból.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{rejected>0&&<span className="user-pill">{rejected} javítandó</span>}{review>0&&<span className="user-pill">{review} ellenőrzésre vár</span>}</div></div>
  <div style={{display:"grid",gap:8,padding:14}}>{visible.map(t=><article key={t.id} style={{border:"1px solid #e2e6e1",borderRadius:10,padding:12,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}><div><strong>{t.title}</strong>{t.dueDate&&<small style={{display:"block",marginTop:3,color:"#657166"}}>Határidő: {t.dueDate}</small>}<TaskLifecycleStrip task={t}/></div><Link className="ghost-btn" href={t.fieldId?`/fields/${t.fieldId}`:scope==="advisor"?"/admin/tasks":"/tasks"}>Megnyitás</Link></div></article>)}</div>
 </section>;
}
