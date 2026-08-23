import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {NotificationBell} from "@/components/NotificationBell";
import {ADVISOR_VISIT_EVENT,decodeAdvisorVisit} from "@/lib/advisorVisits";
import styles from "./admin-dashboard.module.css";

function d(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function daysUntil(v:string|null|undefined){if(!v)return null;const now=new Date();now.setHours(0,0,0,0);const x=new Date(v);x.setHours(0,0,0,0);return Math.ceil((x.getTime()-now.getTime())/86400000)}

export default async function AdminPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farmers},{data:farms},{data:fields},{data:reports},{data:tasks},{data:inspections},{data:visitEvents}]=await Promise.all([
  supabase.from("profiles").select("id,full_name").eq("role","farmer"),
  supabase.from("farms").select("id,name,owner_id"),
  supabase.from("fields").select("id,name,farm_id,area_ha,current_crop"),
  supabase.from("farmer_reports").select("id,title,status,created_at,field_id").order("created_at",{ascending:false}).limit(50),
  supabase.from("tasks").select("id,title,status,due_date,field_id,farm_id,priority").order("due_date",{ascending:true}).limit(100),
  supabase.from("inspections").select("id,field_id,inspected_at,condition,next_check_at,issue_status").order("inspected_at",{ascending:false}).limit(300),
  supabase.from("timeline_events").select("id,farm_id,field_id,description,event_at").eq("event_type",ADVISOR_VISIT_EVENT).eq("created_by",user.id).order("event_at",{ascending:true}).limit(200)
 ]);
 const fieldMap=new Map((fields??[]).map(f=>[f.id,f])),farmMap=new Map((farms??[]).map(f=>[f.id,f]));
 const latest=new Map<string,any>();for(const i of inspections??[])if(i.field_id&&!latest.has(i.field_id))latest.set(i.field_id,i);
 const openReports=(reports??[]).filter(r=>r.status!=="closed"),openTasks=(tasks??[]).filter(t=>t.status!=="done"),overdue=openTasks.filter(t=>{const x=daysUntil(t.due_date);return x!==null&&x<0});
 const critical=[...latest.values()].filter(i=>i.condition==="critical"),attention=[...latest.values()].filter(i=>i.condition==="attention");
 const today=new Date().toISOString().slice(0,10);const dueInspections=(inspections??[]).filter(i=>i.issue_status!=="resolved"&&i.next_check_at&&i.next_check_at<=today);
 const visits=(visitEvents??[]).map(e=>decodeAdvisorVisit(e.description)).filter(Boolean);const plannedVisits=visits.filter(v=>v?.status==="planned"&&new Date(v.scheduledAt)>=new Date());
 const totalArea=(fields??[]).reduce((s,f)=>s+Number(f.area_ha||0),0),year=new Date().getFullYear();
 const alerts=[...critical.slice(0,3).map(i=>({kind:"Kritikus szemle",text:fieldMap.get(i.field_id)?.name||"Földtábla",href:`/fields/${i.field_id}`})),...overdue.slice(0,3).map(t=>({kind:"Lejárt feladat",text:t.title,href:t.field_id?`/fields/${t.field_id}`:"/admin/tasks"})),...openReports.slice(0,3).map(r=>({kind:"Új gazdálkodói jelzés",text:r.title,href:"/admin/reports"}))].slice(0,6);
 const tiles=[
  {href:"/admin/clients",icon:"♙",title:"Ügyfelek",count:farmers?.length??0,meta:`${farms?.length??0} gazdaság · ${fields?.length??0} tábla`},
  {href:"/admin/map",icon:"⌖",title:"Területek / térkép",count:critical.length+attention.length,meta:`${critical.length} kritikus · ${attention.length} figyelmeztetés`},
  {href:"/admin/inspections",icon:"◉",title:"Szemlék",count:dueInspections.length,meta:"esedékes visszaellenőrzés"},
  {href:"/admin/tasks",icon:"☑",title:"Feladatok",count:openTasks.length,meta:`${overdue.length} lejárt`},
  {href:"/admin/reports",icon:"✉",title:"Gazdálkodói üzenetek",count:openReports.length,meta:"nyitott bejelentés"},
  {href:"/admin/visits",icon:"◷",title:"Látogatások",count:plannedVisits.length,meta:"tervezett terepmunka"},
  {href:"/admin/documents",icon:"▤",title:"Dokumentumok",count:0,meta:"kereshető irattár"},
  {href:"/admin/priorities",icon:"!",title:"Mai prioritások",count:critical.length+overdue.length+dueInspections.length,meta:"azonnali figyelmet igényel"},
 ];
 return <main className={styles.page}>
  <header className={styles.topbar}><div className={styles.welcome}><h1>Üdvözöljük, {me?.full_name||"Szaktanácsadó"}!</h1><p>Válasszon munkaterületet, vagy nyissa meg a sürgős ügyeket.</p></div><div className={styles.topActions}><NotificationBell/><div className={styles.year}>▣ {year}</div></div></header>
  <section className={styles.quickGrid}>{tiles.map(t=><Link key={t.href} href={t.href} className={styles.quickCard}><span className={styles.quickIcon}>{t.icon}</span><div><strong>{t.title}</strong><small>{t.meta}</small></div><span className={styles.quickCount}>{t.count}</span></Link>)}</section>
  {alerts.length>0&&<section className={styles.alerts}><div className={styles.alertHead}><div><strong>Kiemelt figyelmeztetések</strong><small>{critical.length} kritikus · {overdue.length} lejárt feladat · {openReports.length} nyitott jelzés</small></div><Link href="/admin/priorities">Mai prioritások →</Link></div><div className={styles.alertGrid}>{alerts.map((a,i)=><Link href={a.href} className={styles.alert} key={`${a.kind}-${i}`}><span>!</span><div><b>{a.kind}</b><small>{a.text}</small></div></Link>)}</div></section>}
  <section className={styles.stats}><article className={styles.stat}><div className={styles.icon}>≋</div><div><div className={styles.label}>Kezelt terület</div><div className={styles.value}>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</div><div className={styles.meta}>{fields?.length??0} tábla</div></div></article><article className={styles.stat}><div className={styles.icon}>♙</div><div><div className={styles.label}>Ügyfelek</div><div className={styles.value}>{farmers?.length??0}</div><div className={styles.meta}>{farms?.length??0} gazdaság</div></div></article><article className={styles.stat}><div className={styles.icon}>!</div><div><div className={styles.label}>Figyelmet igényel</div><div className={styles.value}>{critical.length+attention.length}</div><div className={styles.meta}>{critical.length} kritikus · {attention.length} sárga</div></div></article><article className={styles.stat}><div className={styles.icon}>◷</div><div><div className={styles.label}>Tervezett látogatás</div><div className={styles.value}>{plannedVisits.length}</div><div className={styles.meta}>következő időszak</div></div></article></section>
  <section className={styles.content}><article className={styles.panel}><div className={styles.panelHead}><h2>Következő feladatok</h2><Link href="/admin/tasks">Összes feladat</Link></div>{openTasks.length?<div className={styles.list}>{openTasks.slice(0,8).map(t=>{const days=daysUntil(t.due_date),urgent=t.priority==="urgent"||t.priority==="high"||(days!==null&&days<=3);return <Link href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"} className={styles.row} key={t.id}><span className={`${styles.rowIcon} ${urgent?styles.warn:""}`}>{urgent?"!":"☑"}</span><div><strong>{t.title}</strong><small>{fieldMap.get(t.field_id)?.name||farmMap.get(t.farm_id)?.name||"Gazdaság"}</small></div><time>{days===null?"Nincs határidő":days<0?`${Math.abs(days)} napja lejárt`:days===0?"Ma":`${days} nap múlva`}<br/><em>{d(t.due_date)}</em></time></Link>})}</div>:<div className={styles.empty}>Nincs nyitott feladat.</div>}</article><article className={styles.panel}><div className={styles.panelHead}><h2>Gazdálkodói jelzések</h2><Link href="/admin/reports">Összes bejelentés</Link></div>{openReports.length?<div className={styles.list}>{openReports.slice(0,8).map(r=><Link href="/admin/reports" className={styles.row} key={r.id}><span className={`${styles.rowIcon} ${styles.warn}`}>✉</span><div><strong>{r.title}</strong><small>{fieldMap.get(r.field_id)?.name||"Földtábla"}</small></div><time>{d(r.created_at)}</time></Link>)}</div>:<div className={styles.empty}>Nincs nyitott bejelentés.</div>}</article></section>
 </main>;
}
