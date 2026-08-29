import Link from "next/link";
import {dailyWorkSeverityLabel,prioritizeDailyWork,type DailyWorkInput} from "@/lib/dailyWorkPriority";

export function DailyPriorityBoard({items,title="Mai prioritások",limit=8}:{items:DailyWorkInput[];title?:string;limit?:number}){
 const prioritized=prioritizeDailyWork(items).slice(0,limit);
 return <section className="panel" data-help-block="daily-priority-board">
  <div className="panel-heading"><div><span className="eyebrow">NAPI PRIORITÁSI MOTOR</span><h2>{title}</h2></div><span className="user-pill">{prioritized.length} kiemelt tétel</span></div>
  <div style={{display:"grid",gap:9,padding:14}}>
   {prioritized.map(item=>{
    const href=item.fieldId?`/fields/${item.fieldId}`:item.kind==="report"?"/admin/reports":item.kind==="inspection"?"/admin/inspections":item.kind==="approval"?"/operations/approvals":"/admin/tasks";
    const border=item.severity==="critical"?"#a72f27":item.severity==="high"?"#b77700":"#39752f";
    return <Link key={`${item.kind}-${item.id}`} href={href} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,alignItems:"center",padding:13,border:"1px solid #dfe5df",borderLeft:`4px solid ${border}`,borderRadius:12,textDecoration:"none",color:"inherit",background:"#fff"}}>
     <div><small style={{fontWeight:900,color:border}}>{dailyWorkSeverityLabel(item.severity)} · {item.score} pont</small><strong style={{display:"block",margin:"3px 0"}}>{item.title}</strong><small style={{display:"block",color:"#6f7c74",lineHeight:1.45}}>{item.reasons.length?item.reasons.join(" · "):"Nincs külön sürgősségi jelzés"}</small></div>
     <span className="ghost-btn">Megnyitás</span>
    </Link>})}
   {!prioritized.length&&<div className="empty-state">Nincs kiemelt napi prioritás.</div>}
  </div>
 </section>;
}
