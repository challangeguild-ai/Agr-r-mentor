import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {NotificationBell} from "@/components/NotificationBell";
import {BlockHelpButton} from "@/components/GuidedTour";
import {dailyWorkSeverityLabel,prioritizeDailyWork,type DailyWorkInput} from "@/lib/dailyWorkPriority";
import styles from "./dashboard.module.css";

function d(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function daysUntil(v:string|null|undefined){if(!v)return null;const n=new Date();n.setHours(0,0,0,0);const x=new Date(v);x.setHours(0,0,0,0);return Math.ceil((x.getTime()-n.getTime())/86400000)}
function conditionLabel(v:string|null|undefined){return v==="critical"?"Kritikus":v==="attention"?"Figyelmet igényel":v==="good"?"Jó":"Nincs szemle"}
function isAfter(a:string|null|undefined,b:string|null|undefined){return !!a&&!!b&&new Date(a).getTime()>=new Date(b).getTime()}
function eventLabel(v:string|null){const m:Record<string,string>={inspection:"Helyszíni szemle",inspection_followup:"Visszaellenőrzés",task:"Teendő",task_completed:"Teendő elvégezve",task_submitted_review:"Végrehajtás beküldve",task_review_approved:"Végrehajtás jóváhagyva",task_review_rejected:"Végrehajtás javításra visszaküldve",farmer_report:"Bejelentés",advisor_reply:"Szaktanácsadói válasz",field_operation:"Gazdálkodási művelet",weather_observation:"Időjárási esemény"};return m[v||""]||"Gazdasági esemény"}

export default async function DashboardPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("full_name,role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin");

 const[{data:farms},{data:tasks},{data:timeline},{data:documents},{data:inspections},{data:reports}]=await Promise.all([
  supabase.from("farms").select("id,name,settlement").order("created_at"),
  supabase.from("tasks").select("id,title,due_date,priority,status,review_status,field_id,farm_id,created_at").order("due_date",{ascending:true,nullsFirst:false}).limit(300),
  supabase.from("timeline_events").select("id,event_type,title,description,event_at,created_at,field_id").order("event_at",{ascending:false}).limit(6),
  supabase.from("documents").select("id,title,created_at,file_size").order("created_at",{ascending:false}).limit(3),
  supabase.from("inspections").select("id,inspected_at,field_id,condition,next_check_at,issue_status").order("inspected_at",{ascending:false}).limit(200),
  supabase.from("farmer_reports").select("id,title,status,field_id,advisor_reply,replied_at,created_at").order("created_at",{ascending:false}).limit(100)
 ]);
 const farmIds=(farms??[]).map(f=>f.id);
 const{data:fields}=farmIds.length?await supabase.from("fields").select("id,name,area_ha,current_crop,crop_year,farm_id").in("farm_id",farmIds).order("name"):{data:[]};
 const reportIds=(reports??[]).map(r=>r.id);
 const{data:receipts}=reportIds.length?await supabase.from("communication_receipts").select("entity_id,last_seen_at").eq("entity_type","farmer_report").eq("viewer_id",user.id).in("entity_id",reportIds):{data:[]};

 const farmMap=new Map((farms??[]).map(f=>[f.id,f])),fieldMap=new Map((fields??[]).map(f=>[f.id,f])),receiptMap=new Map((receipts??[]).map(r=>[r.entity_id,r.last_seen_at]));
 const inspectionMap=new Map<string,any>();for(const i of inspections??[]){if(i.field_id&&!inspectionMap.has(i.field_id))inspectionMap.set(i.field_id,i)}
 const openTasks=(tasks??[]).filter(t=>t.status!=="done"&&t.status!=="cancelled");
 const overdue=openTasks.filter(t=>{const x=daysUntil(t.due_date);return x!==null&&x<0});
 const waitingReview=openTasks.filter(t=>t.status==="submitted"||t.review_status==="pending");
 const critical=[...inspectionMap.values()].filter(i=>i.condition==="critical"),attention=[...inspectionMap.values()].filter(i=>i.condition==="attention");
 const unreadReplies=(reports??[]).filter(r=>{if(!r.advisor_reply||r.status==="closed"||!r.replied_at)return false;const seen=receiptMap.get(r.id);return !seen||!isAfter(seen,r.replied_at)});
 const totalArea=(fields??[]).reduce((sum,f)=>sum+Number(f.area_ha||0),0),name=profile?.full_name||"Gazdálkodó";

 const workItems:DailyWorkInput[]=[
  ...openTasks.map(t=>({id:t.id,kind:"task" as const,title:t.title,dueAt:t.due_date,createdAt:t.created_at,priority:t.priority,status:t.status,farmId:t.farm_id,fieldId:t.field_id})),
  ...(inspections??[]).filter(i=>i.condition==="critical"||!!i.next_check_at).map(i=>({id:i.id,kind:"inspection" as const,title:i.condition==="critical"?"Kritikus táblaállapot":"Visszaellenőrzés",dueAt:i.next_check_at,createdAt:i.inspected_at,condition:i.condition,status:i.issue_status,fieldId:i.field_id})),
  ...unreadReplies.map(r=>({id:r.id,kind:"report" as const,title:r.title,createdAt:r.replied_at||r.created_at,status:r.status,unread:true,fieldId:r.field_id}))
 ];
 const prioritized=prioritizeDailyWork(workItems).slice(0,4);
 const resume=[
  ...openTasks.filter(t=>t.status==="in_progress").map(t=>({id:"p-"+t.id,title:t.title,meta:"Folyamatban lévő munka",step:"3/5",pct:60,href:"/tasks"})),
  ...openTasks.filter(t=>t.review_status==="rejected").map(t=>({id:"r-"+t.id,title:t.title,meta:"Javításra visszaküldött végrehajtás",step:"3/5",pct:60,href:"/tasks"})),
  ...waitingReview.map(t=>({id:"w-"+t.id,title:t.title,meta:"Ellenőrzésre beküldve",step:"4/5",pct:80,href:"/tasks"})),
  ...unreadReplies.map(r=>({id:"m-"+r.id,title:r.title,meta:"Új szaktanácsadói válasz",step:"1/2",pct:50,href:"/messages"}))
 ].slice(0,3);
 const fieldCards=(fields??[]).map(f=>({field:f,inspection:inspectionMap.get(f.id)})).sort((a,b)=>{const rank=(v:string|undefined)=>v==="critical"?0:v==="attention"?1:v==="good"?2:3;return rank(a.inspection?.condition)-rank(b.inspection?.condition)||a.field.name.localeCompare(b.field.name,"hu")}).slice(0,3);
 const loc=(item:DailyWorkInput)=>item.fieldId?fieldMap.get(item.fieldId)?.name||"Földtábla":item.farmId?farmMap.get(item.farmId)?.name||"Gazdaság":"Gazdasági ügy";
 const href=(item:DailyWorkInput)=>item.kind==="report"?"/messages":item.kind==="inspection"&&item.fieldId?"/fields/"+item.fieldId:"/tasks";
 const action=(item:DailyWorkInput)=>item.kind==="report"?"Üzenet":item.kind==="inspection"?"Tábla":"Feladat";

 return <div className="app-shell farmer-app"><Sidebar active="dashboard" userName={name}/><main className={["dashboard",styles.page].join(" ")}>
  <header className={styles.topbar}><div><span className={styles.kicker}>AGRÁR MENTOR 2.1</span><h1>Mai munkaközpont</h1><p>A fontos ügyek, folytatható munkák és táblák egyetlen operatív nézetben.</p></div><div className={styles.topActions}><BlockHelpButton label="A munkaközpont magyarázata" content={{title:"Mai munkaközpont",body:"A kezdőlap azt mutatja, mi igényel figyelmet, mit lehet folytatni, és mi a következő konkrét lépés.",important:"A prioritás döntéstámogatás; a rendszer nem hagy jóvá műveletet és nem zár le feladatot automatikusan."}}/><NotificationBell/><div className={styles.userChip}>{name}</div></div></header>

  <section className={styles.hero}><div><span className={styles.heroEyebrow}>MAI HELYZETKÉP</span><h2>Ma <strong>{critical.length+overdue.length+waitingReview.length+unreadReplies.length}</strong> dolog igényel figyelmet</h2><div className={styles.heroSignals}><span className={critical.length?styles.signalCritical:styles.signalOk}>{critical.length} kritikus tábla</span><span className={overdue.length?styles.signalWarn:styles.signalOk}>{overdue.length} lejárt feladat</span><span className={waitingReview.length?styles.signalReview:styles.signalOk}>{waitingReview.length} ellenőrzésre vár</span><span className={unreadReplies.length?styles.signalInfo:styles.signalOk}>{unreadReplies.length} új válasz</span></div><div className={styles.heroActions}><Link className={styles.primaryCta} href="/daily-work">Mai munkám megnyitása →</Link><Link className={styles.secondaryCta} href="/messages">Új bejelentés</Link></div></div><div className={styles.heroAside}><span>Gazdaság összesen</span><strong>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha</strong><small>{fields?.length??0} tábla · {openTasks.length} nyitott teendő</small></div></section>

  <section className={styles.summaryGrid}>
   <Link href="/fields" className={styles.summaryCard}><span className={styles.summaryIcon}>!</span><div><small>Kritikus táblák</small><strong>{critical.length}</strong><p>{attention.length} további figyelmet igényel</p></div></Link>
   <Link href="/tasks" className={styles.summaryCard}><span className={styles.summaryIcon}>◷</span><div><small>Lejárt feladatok</small><strong>{overdue.length}</strong><p>{openTasks.length} nyitott feladat összesen</p></div></Link>
   <Link href="/tasks" className={styles.summaryCard}><span className={styles.summaryIcon}>◎</span><div><small>Ellenőrzésre vár</small><strong>{waitingReview.length}</strong><p>Beküldött végrehajtások</p></div></Link>
   <Link href="/messages" className={styles.summaryCard}><span className={styles.summaryIcon}>✉</span><div><small>Új szakmai válaszok</small><strong>{unreadReplies.length}</strong><p>Ténylegesen nem látott válaszok</p></div></Link>
  </section>

  <section className={styles.commandGrid}><article className={styles.panel}><div className={styles.panelHead}><div><span>FOLYTATHATÓ FOLYAMATOK</span><h2>Folytasd innen</h2></div><Link href="/daily-work">Összes folyamat →</Link></div><div className={styles.resumeGrid}>{resume.length?resume.map(item=><article className={styles.resumeCard} key={item.id}><div><small>{item.meta}</small><strong>{item.title}</strong></div><div className={styles.progressMeta}><span>{item.step} lépés</span><b>{item.pct}%</b></div><div className={styles.progress}><i style={{width:String(item.pct)+"%"}}/></div><Link href={item.href}>Folytatás →</Link></article>):<div className={styles.emptyResume}><strong>Nincs félbehagyott munkafolyamat.</strong><span>Indíts új műveletet vagy ellenőrizd a mai prioritásokat.</span></div>}</div></article>
   <aside className={styles.guided}><div className={styles.panelHead}><div><span>VEZETETT MŰVELETEK</span><h2>Gyors indítás</h2></div></div><Link href="/operations"><span>✣</span><div><strong>Művelet rögzítése</strong><small>Vezetett rögzítési folyamat</small></div><b>→</b></Link><Link href="/messages"><span>✉</span><div><strong>Új bejelentés</strong><small>Szakmai jelzés küldése</small></div><b>→</b></Link><Link href="/dispatch"><span>↗</span><div><strong>Munka kiosztása</strong><small>Feladat, végrehajtó és gép</small></div><b>→</b></Link><Link href="/documents"><span>□</span><div><strong>Dokumentum kezelése</strong><small>Irat vagy bizonyíték kezelése</small></div><b>→</b></Link></aside>
  </section>

  <section className={styles.workAndFields}><article className={styles.panel}><div className={styles.panelHead}><div><span>NAPI PRIORITÁSI MOTOR</span><h2>Mai prioritások</h2></div><Link href="/daily-work">Teljes lista →</Link></div><div className={styles.priorityList}>{prioritized.length?prioritized.map((item,index)=>{const tone=item.severity==="critical"?styles.priorityCritical:item.severity==="high"?styles.priorityHigh:styles.priorityNormal;return <Link className={styles.priorityRow} href={href(item)} key={item.kind+"-"+item.id}><span className={styles.priorityIndex}>{index+1}</span><span className={[styles.priorityBadge,tone].join(" ")}>{dailyWorkSeverityLabel(item.severity)}</span><div><strong>{item.title}</strong><small>{loc(item)} · {item.reasons.join(" · ")||"Normál prioritás"}</small></div><b>{action(item)} megnyitása →</b></Link>}):<div className={styles.emptyState}>Nincs kiemelt napi prioritás.</div>}</div></article>

   <article className={styles.panel}><div className={styles.panelHead}><div><span>TÁBLASZINTŰ HELYZETKÉP</span><h2>Táblák állapota</h2></div><Link href="/fields">Összes tábla →</Link></div><div className={styles.fieldCards}>{fieldCards.length?fieldCards.map(({field,inspection})=>{const tone=inspection?.condition==="critical"?styles.fieldCritical:inspection?.condition==="attention"?styles.fieldAttention:styles.fieldGood;return <Link href={"/fields/"+field.id} className={styles.fieldCard} key={field.id}><div className={styles.fieldTop}><div><strong>{field.name}</strong><small>{field.area_ha?String(field.area_ha)+" ha":"—"} · {field.current_crop||"Nincs kultúra"}</small></div><span className={tone}>{conditionLabel(inspection?.condition)}</span></div><dl><div><dt>Utolsó szemle</dt><dd>{d(inspection?.inspected_at)}</dd></div><div><dt>Gazdasági év</dt><dd>{field.crop_year||new Date().getFullYear()}</dd></div></dl></Link>}):<div className={styles.emptyState}>Még nincs rögzített földtábla.</div>}</div></article>
  </section>

  <section className={styles.lowerGrid}><article className={styles.panel}><div className={styles.panelHead}><div><span>LEGUTÓBBI ESEMÉNYEK</span><h2>Gazdasági idővonal</h2></div><Link href="/timeline">Teljes idővonal →</Link></div><div className={styles.timeline}>{timeline?.length?timeline.map(e=><div className={styles.event} key={e.id}><time>{d(e.event_at||e.created_at)}</time><div><strong>{eventLabel(e.event_type)}</strong><p>{e.description||e.title}</p></div></div>):<div className={styles.emptyState}>Még nincs esemény.</div>}</div></article>
   <article className={styles.panel}><div className={styles.panelHead}><div><span>DOKUMENTUMOK</span><h2>Legutóbbi dokumentumok</h2></div><Link href="/documents">Összes →</Link></div><div className={styles.docs}>{documents?.length?documents.map(doc=><Link href="/documents" className={styles.doc} key={doc.id}><span>▤</span><div><strong>{doc.title}</strong><small>{d(doc.created_at)}{doc.file_size?" · "+(Number(doc.file_size)/1048576).toLocaleString("hu-HU",{maximumFractionDigits:1})+" MB":""}</small></div></Link>):<div className={styles.emptyState}>Még nincs feltöltött dokumentum.</div>}</div></article>
  </section>
 </main></div>
}
