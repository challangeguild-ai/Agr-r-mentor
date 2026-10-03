import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {TaskProofCompleteForm} from "@/components/TaskProofCompleteForm";
import {TaskProofPhoto} from "@/components/TaskProofPhoto";
import {BlockHelpButton} from "@/components/GuidedTour";
import {decodeTaskProof} from "@/lib/taskProof";
import styles from "./tasks.module.css";

type SearchParams=Promise<{view?:string}>;
function dateKey(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function addDaysKey(days:number){const d=new Date();d.setDate(d.getDate()+days);return dateKey(d)}
function formatDate(value:string|null){return value?new Intl.DateTimeFormat("hu-HU",{timeZone:"Europe/Budapest"}).format(new Date(`${value}T12:00:00`)):"Nincs határidő"}
function priorityLabel(v:string){return v==="urgent"?"Magas":v==="high"?"Magas":"Normál"}

export default async function TasksPage({searchParams}:{searchParams:SearchParams}){
 const{view="open"}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin/tasks");

 const{data:tasks,error}=await supabase.from("tasks").select("id,title,description,due_date,priority,status,review_status,review_note,task_kind,linked_operation_id,completed_at,field_id,farm_id,assigned_to,created_at").order("updated_at",{ascending:false}).eq("assigned_to",user.id);
 if(error)throw new Error(error.message);
 const ids=(tasks??[]).map(t=>t.id),fieldIds=[...new Set((tasks??[]).map(t=>t.field_id).filter(Boolean))] as string[],farmIds=[...new Set((tasks??[]).map(t=>t.farm_id).filter(Boolean))] as string[];
 const[{data:fields},{data:farms},{data:plans},{data:reports},{data:assignments}]=await Promise.all([
  fieldIds.length?supabase.from("fields").select("id,name").in("id",fieldIds):Promise.resolve({data:[]}),
  farmIds.length?supabase.from("farms").select("id,name").in("id",farmIds):Promise.resolve({data:[]}),
  ids.length?supabase.from("task_operation_plans").select("task_id,country_code,operation_type,subtype,product_name,crop,target,planned_dose,dose_min,dose_max,dose_unit,planned_area,planned_quantity,quantity_unit,bbch_min,bbch_max,phi_days,restrictions").in("task_id",ids):Promise.resolve({data:[]}),
  ids.length?supabase.from("task_execution_reports").select("task_id,proof,actual_dose,dose_unit,actual_area,actual_quantity,quantity_unit,weather,notes,review_status,review_note").in("task_id",ids):Promise.resolve({data:[]}),
  ids.length?supabase.from("task_machine_assignments").select("task_id,machine_id").in("task_id",ids):Promise.resolve({data:[]})
 ]);

 const planMap=new Map((plans??[]).map(p=>[p.task_id,p])),reportMap=new Map((reports??[]).map(r=>[r.task_id,r])),machineTasks=new Set((assignments??[]).map(a=>a.task_id));
 const today=dateKey(),weekEnd=addDaysKey(7);
 const open=(tasks??[]).filter(t=>t.status!=="done"&&t.status!=="submitted"),submitted=(tasks??[]).filter(t=>t.status==="submitted"),overdue=open.filter(t=>t.due_date&&t.due_date<today),upcoming=open.filter(t=>t.due_date&&t.due_date>=today&&t.due_date<=weekEnd),done=(tasks??[]).filter(t=>t.status==="done");
 const visible=(tasks??[]).filter(t=>view==="submitted"?t.status==="submitted":view==="overdue"?t.status!=="done"&&t.status!=="submitted"&&!!t.due_date&&t.due_date<today:view==="upcoming"?t.status!=="done"&&t.status!=="submitted"&&!!t.due_date&&t.due_date>=today&&t.due_date<=weekEnd:view==="done"?t.status==="done":view==="all"?true:t.status!=="done"&&t.status!=="submitted");
 const tabs=[["open","Összes",open.length],["submitted","Folyamatban",submitted.length],["done","Befejezett",done.length],["overdue","Lejárt",overdue.length]] as const;

 return <div className="app-shell farmer-app">
  <Sidebar active="tasks" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés teendők, határidők vagy táblák között…"/>
   <section className={styles.titleRow}><div><h1>Teendők</h1><p>Kövesd a feladataidat és a megoldási folyamatot.</p></div><BlockHelpButton label="A teendők magyarázata" content={{title:"Teendők és műveleti tervek",body:"A feladatok a szakmai tervtől a végrehajtáson át a visszaigazolásig követhetők.",important:"Az ellenőrzésre váró tétel még nem végleges naplóbejegyzés."}}/></section>

   <nav className={styles.tabs}>{tabs.map(([key,label,count])=><Link className={view===key?styles.active:""} key={key} href={`/tasks?view=${key}`}>{label}<span>{count}</span></Link>)}<Link className={view==="upcoming"?styles.active:""} href="/tasks?view=upcoming">7 napon belül<span>{upcoming.length}</span></Link><Link className={view==="all"?styles.active:""} href="/tasks?view=all">Mind<span>{tasks?.length??0}</span></Link></nav>

   <section className={styles.listPanel}>
    <div className={styles.listHead}><span>Feladat</span><span>Határidő</span><span>Prioritás</span><span>Állapot / Művelet</span></div>
    <div className={styles.list}>
     {visible.length?visible.map(t=>{const field=fields?.find(f=>f.id===t.field_id),farm=farms?.find(f=>f.id===t.farm_id),plan=planMap.get(t.id),report=reportMap.get(t.id),proof=report?.proof?decodeTaskProof(report.proof):null,isOverdue=t.status!=="done"&&t.status!=="submitted"&&!!t.due_date&&t.due_date<today;return <article className={`${styles.card} ${isOverdue?styles.overdue:""}`} key={t.id}>
      <div className={styles.taskInfo}><span className={`${styles.taskIcon} ${t.priority==="urgent"?styles.iconUrgent:t.priority==="high"?styles.iconHigh:styles.iconNormal}`}>{t.task_kind==="operation"?"✣":"✓"}</span><div><strong>{t.title}</strong><small>{farm?.name||"Gazdaság"} · {field?.name||"Teljes gazdaság"}</small></div></div>
      <div className={`${styles.deadline} ${isOverdue?styles.deadlineOver:""}`}>{isOverdue?"● ":""}{formatDate(t.due_date)}</div>
      <span className={`${styles.priority} ${t.priority==="urgent"||t.priority==="high"?styles.high:styles.normal}`}>{priorityLabel(t.priority)}</span>
      <div className={styles.actions}>
       {t.status==="submitted"&&<span className={styles.waiting}>Ellenőrzésre vár</span>}
       {t.status==="done"&&<span className={styles.done}>✓ Befejezve</span>}
       {t.field_id&&<Link className={styles.linkButton} href={`/fields/${t.field_id}`}>Tábla →</Link>}
       {t.linked_operation_id&&<Link className={styles.linkButton} href={`/operations/${t.linked_operation_id}`}>Napló →</Link>}
      </div>
      {(t.description||plan||t.review_status==="rejected"||report)&&<div className={styles.details}>
       {t.description&&<p>{t.description}</p>}
       {plan&&<div className={styles.plan}><b>{plan.country_code==="HU"?"🇭🇺":"🇸🇰"} {plan.product_name||plan.subtype||plan.operation_type}</b><span>{plan.crop||""}{plan.target?` · ${plan.target}`:""}{plan.planned_dose!=null?` · ${plan.planned_dose} ${plan.dose_unit||""}`:""}</span></div>}
       {t.review_status==="rejected"&&<div className={styles.rejected}><b>Javításra visszaküldve.</b> {t.review_note||"Rögzítsd újra a végrehajtást."}</div>}
       {report&&t.status==="submitted"&&<p><b>Beküldött végrehajtás:</b> {report.actual_dose!=null?`${report.actual_dose} ${report.dose_unit||""}`:"dózis nélkül"}{report.actual_area!=null?` · ${report.actual_area} ha`:""}</p>}
       <div className={styles.proofActions}>{proof&&<TaskProofPhoto path={proof.photoPath} name={proof.photoName}/>} {t.status!=="done"&&t.status!=="submitted"&&t.field_id&&<TaskProofCompleteForm taskId={t.id} hasMachine={machineTasks.has(t.id)} plan={plan?{operationType:plan.operation_type,productName:plan.product_name,plannedDose:plan.planned_dose,doseMin:plan.dose_min,doseMax:plan.dose_max,doseUnit:plan.dose_unit,plannedArea:plan.planned_area,plannedQuantity:plan.planned_quantity,quantityUnit:plan.quantity_unit}:null}/>}</div>
      </div>}
     </article>}):<div className={styles.empty}>Ebben a nézetben nincs teendő.</div>}
    </div>
   </section>
  </main>
 </div>;
}
