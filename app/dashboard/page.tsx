import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {NotificationBell} from "@/components/NotificationBell";
import styles from "./dashboard.module.css";

function d(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function daysUntil(v:string|null|undefined){if(!v)return null;const n=new Date();n.setHours(0,0,0,0);const x=new Date(v);x.setHours(0,0,0,0);return Math.ceil((x.getTime()-n.getTime())/86400000)}
function cleanTitle(v:string){return v.replace("attention","Figyelmet igényel").replace("critical","Kritikus").replace("good","Jó állapot")}
function eventLabel(v:string|null){const m:Record<string,string>={inspection:"Helyszíni szemle",task:"Teendő kiadva",task_completed:"Teendő elvégezve",farmer_report:"Bejelentés",advisor_reply:"Szaktanácsadói válasz",report_closed:"Bejelentés lezárva"};return m[v||""]||"Gazdasági esemény"}
function conditionLabel(v:string|null|undefined){if(v==="good")return"Megfelelő";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}

export default async function DashboardPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
  if(profile?.role==="advisor")redirect("/admin");

  const[{data:farms},{data:tasks},{data:timeline},{data:documents},{data:inspections}]=await Promise.all([
    supabase.from("farms").select("id,name,settlement").order("created_at"),
    supabase.from("tasks").select("id,title,due_date,priority,status,field_id,farm_id,description").order("due_date",{ascending:true}),
    supabase.from("timeline_events").select("id,event_type,title,description,event_at,created_at,field_id").order("event_at",{ascending:false}).limit(5),
    supabase.from("documents").select("id,title,category,file_name,created_at,field_id,file_size").order("created_at",{ascending:false}).limit(3),
    supabase.from("inspections").select("id,inspected_at,field_id,condition").order("inspected_at",{ascending:false}).limit(100),
  ]);

  const farmIds=(farms??[]).map(f=>f.id);
  const{data:fields}=farmIds.length?await supabase.from("fields").select("id,name,area_ha,current_crop,crop_year,farm_id").in("farm_id",farmIds).order("created_at"):{data:[]};
  const fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
  const inspectionMap=new Map<string,any>();
  for(const i of inspections??[]){if(i.field_id&&!inspectionMap.has(i.field_id))inspectionMap.set(i.field_id,i)}
  const lastInspection=(inspections??[])[0];
  const openTasks=(tasks??[]).filter(t=>t.status!=="done");
  const totalArea=(fields??[]).reduce((sum,f)=>sum+Number(f.area_ha||0),0);
  const nextTask=openTasks.filter(t=>t.due_date).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0];
  const nextDays=daysUntil(nextTask?.due_date);
  const name=profile?.full_name||"Gazdálkodó";
  const year=new Date().getFullYear();

  return <div className="app-shell farmer-app"><Sidebar active="dashboard" userName={name}/><main className={`dashboard ${styles.page}`}>
    <header className={styles.topbar}><div className={styles.welcome}><h1>Üdvözöljük, {name}!</h1><p>Áttekintés a gazdaságáról és a következő teendőkről.</p></div><div className={styles.topActions}><NotificationBell/><div className={styles.year}>▣ {year}⌄</div></div></header>
    <section className={styles.stats}>
      <article className={styles.stat}><div className={styles.statIcon}>≋</div><div><div className={styles.statLabel}>Összes terület</div><div className={styles.statValue}>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha</div><div className={styles.statMeta}>{fields?.length??0} tábla</div></div></article>
      <article className={styles.stat}><div className={styles.statIcon}>☑</div><div><div className={styles.statLabel}>Aktuális teendők</div><div className={styles.statValue}>{openTasks.length}</div><div className={styles.statMeta}>{openTasks.filter(t=>t.due_date).length} határidős</div></div></article>
      <article className={styles.stat}><div className={styles.statIcon}>▣</div><div><div className={styles.statLabel}>Következő határidő</div><div className={styles.statValue}>{nextDays===null?"—":nextDays<0?"Lejárt":nextDays===0?"Ma":`${nextDays} nap múlva`}</div><div className={styles.statMeta}>{nextTask?.title||"Nincs határidős teendő"}</div></div></article>
      <article className={styles.stat}><div className={styles.statIcon}>●</div><div><div className={styles.statLabel}>Utolsó szemle</div><div className={styles.statValue}>{lastInspection?.inspected_at?d(lastInspection.inspected_at):"—"}</div><div className={styles.statMeta}>{lastInspection?.field_id?fieldMap.get(lastInspection.field_id)?.name||"Földtábla":"Még nincs szemle"}</div></div></article>
    </section>
    <section className={styles.content}>
      <div className={styles.left}>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Tábláim térképen</h2><Link href="/fields">Teljes nézet ↗</Link></div><div className={styles.map}><div className={styles.mapTools}><span>+</span><span>−</span><span>▱</span></div>{(fields??[]).slice(0,6).map((f,i)=><Link title={f.name} href={`/fields/${f.id}`} key={f.id} className={`${styles.fieldShape} ${styles[`s${i+1}`]}`}><b>{i+1}</b></Link>)}</div>
          {(fields?.length??0)>0?<><table className={styles.fieldTable}><thead><tr><th>Tábla neve</th><th>Növény</th><th>Terület</th><th>Utolsó szemle</th><th>Állapot</th></tr></thead><tbody>{(fields??[]).slice(0,5).map((f,i)=>{const ins=inspectionMap.get(f.id);const warn=ins?.condition==="attention"||ins?.condition==="critical";return <tr key={f.id}><td><Link href={`/fields/${f.id}`}><span className={styles.number}>{i+1}</span><strong>{f.name}</strong></Link></td><td>{f.current_crop||"—"}</td><td>{f.area_ha?`${f.area_ha} ha`:"—"}</td><td>{ins?d(ins.inspected_at):"—"}</td><td><span className={`${styles.status} ${warn?styles.warn:""}`}>{conditionLabel(ins?.condition)}</span></td></tr>})}</tbody></table><div className={styles.mobileCards}>{(fields??[]).slice(0,5).map(f=>{const ins=inspectionMap.get(f.id);return <Link href={`/fields/${f.id}`} className={styles.mobileField} key={f.id}><span><strong>{f.name}</strong><br/>{f.current_crop||"Nincs kultúra"} · {conditionLabel(ins?.condition)}</span><b>{f.area_ha?`${f.area_ha} ha`:"—"}</b></Link>})}</div></>:<div className={styles.empty}>Még nincs rögzített földtábla.</div>}<div className={styles.panelFooter}><Link href="/fields">Összes tábla megtekintése</Link></div></article>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Legutóbbi dokumentumok</h2><Link href="/documents">Összes dokumentum</Link></div>{documents?.length?<div className={styles.docs}>{documents.map(doc=><Link href="/documents" className={styles.doc} key={doc.id}><div className={styles.docIcon}>▤</div><div><strong>{doc.title}</strong><small>{d(doc.created_at)}{doc.file_size?` · ${(Number(doc.file_size)/1048576).toLocaleString("hu-HU",{maximumFractionDigits:1})} MB`:""}</small></div></Link>)}</div>:<div className={styles.empty}>Még nincs feltöltött dokumentum.</div>}</article>
      </div>
      <div className={styles.right}>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Következő teendők</h2><Link href="/tasks">Összes megnyitása</Link></div>{openTasks.length?openTasks.slice(0,4).map(t=>{const days=daysUntil(t.due_date);const urgent=t.priority==="urgent"||t.priority==="high"||(days!==null&&days<=3);return <div className={`${styles.task} ${urgent?styles.urgent:""}`} key={t.id}><div className={styles.taskIcon}>{urgent?"!":"☑"}</div><div><strong>{t.title}</strong><small>{t.field_id?fieldMap.get(t.field_id)?.name||"Földtábla":farms?.find(f=>f.id===t.farm_id)?.name||"Gazdaság"}</small></div><div className={styles.due}>{days===null?"Nincs határidő":days<0?`${Math.abs(days)} napja lejárt`:days===0?"Ma":`${days} nap múlva`}<br/><span>{d(t.due_date)}</span></div></div>}):<div className={styles.empty}>Nincs nyitott teendő.</div>}</article>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Idővonal{fields?.[0]?.name?` – ${fields[0].name}`:""}</h2><Link href="/timeline">Teljes idővonal</Link></div>{timeline?.length?<div className={styles.timeline}>{timeline.map(e=><div className={styles.event} key={e.id}><time>{d(e.event_at||e.created_at)}</time><div><strong>{eventLabel(e.event_type)}</strong><p>{cleanTitle(e.description||e.title)}</p></div></div>)}</div>:<div className={styles.empty}>Még nincs esemény.</div>}</article>
      </div>
    </section>
  </main></div>
}
