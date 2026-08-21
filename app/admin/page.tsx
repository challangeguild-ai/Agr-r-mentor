import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {NotificationBell} from "@/components/NotificationBell";
import styles from "./admin-dashboard.module.css";

function d(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function daysUntil(v:string|null|undefined){if(!v)return null;const now=new Date();now.setHours(0,0,0,0);const x=new Date(v);x.setHours(0,0,0,0);return Math.ceil((x.getTime()-now.getTime())/86400000)}
function conditionLabel(v:string|null|undefined){if(v==="good")return"Megfelelő";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}
function eventLabel(v:string|null|undefined){const m:Record<string,string>={inspection:"Helyszíni szemle",task:"Teendő kiadva",task_completed:"Teendő elvégezve",farmer_report:"Bejelentés",advisor_reply:"Szaktanácsadói válasz",report_closed:"Bejelentés lezárva"};return m[v||""]||"Gazdasági esemény"}

export default async function AdminPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor")redirect("/dashboard");

  const[{data:farmers},{data:farms},{data:fields},{data:reports},{data:tasks},{data:inspections},{data:timeline},{data:documents}]=await Promise.all([
    supabase.from("profiles").select("id,full_name,phone").eq("role","farmer").order("full_name"),
    supabase.from("farms").select("id,name,owner_id,settlement").order("created_at",{ascending:false}),
    supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,crop_year").order("created_at",{ascending:false}),
    supabase.from("farmer_reports").select("id,title,status,created_at,field_id").order("created_at",{ascending:false}).limit(30),
    supabase.from("tasks").select("id,title,status,due_date,field_id,farm_id,priority").order("due_date",{ascending:true}).limit(80),
    supabase.from("inspections").select("id,field_id,inspected_at,condition,notes,recommendation").order("inspected_at",{ascending:false}).limit(100),
    supabase.from("timeline_events").select("id,title,description,event_type,event_at,created_at,field_id").order("event_at",{ascending:false}).limit(8),
    supabase.from("documents").select("id,title,file_name,created_at,field_id,farm_id,file_size").order("created_at",{ascending:false}).limit(4),
  ]);

  const openReports=(reports??[]).filter(r=>r.status!=="closed");
  const openTasks=(tasks??[]).filter(t=>t.status!=="done");
  const totalArea=(fields??[]).reduce((s,f)=>s+Number(f.area_ha||0),0);
  const fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
  const farmMap=new Map((farms??[]).map(f=>[f.id,f]));
  const ownerMap=new Map((farmers??[]).map(f=>[f.id,f]));
  const nextTask=openTasks.filter(t=>t.due_date).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0];
  const nextDays=daysUntil(nextTask?.due_date);
  const lastInspection=(inspections??[])[0];
  const year=new Date().getFullYear();
  const visibleFields=(fields??[]).slice(0,7);
  const latestInspectionFor=(fieldId:string)=> (inspections??[]).find(i=>i.field_id===fieldId);

  return <main className={styles.page}>
    <header className={styles.topbar}><div className={styles.welcome}><h1>Üdvözöljük, {me?.full_name||"Szaktanácsadó"}!</h1><p>Áttekintés az ügyfelekről, kezelt területekről és a következő szakmai feladatokról.</p></div><div className={styles.topActions}><NotificationBell/><div className={styles.year}>▣ {year}⌄</div></div></header>

    <section className={styles.stats}>
      <article className={styles.stat}><div className={styles.icon}>≋</div><div><div className={styles.label}>Kezelt terület</div><div className={styles.value}>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</div><div className={styles.meta}>{fields?.length??0} tábla · {farmers?.length??0} ügyfél</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>☑</div><div><div className={styles.label}>Aktuális teendők</div><div className={styles.value}>{openTasks.length}</div><div className={styles.meta}>{openTasks.filter(t=>t.due_date).length} határidős feladat</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>▣</div><div><div className={styles.label}>Következő határidő</div><div className={styles.value}>{nextDays===null?"—":nextDays<0?"Lejárt":nextDays===0?"Ma":`${nextDays} nap múlva`}</div><div className={styles.meta}>{nextTask?.title||"Nincs határidős teendő"}</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>●</div><div><div className={styles.label}>Utolsó szemle</div><div className={styles.value}>{d(lastInspection?.inspected_at)}</div><div className={styles.meta}>{lastInspection?.field_id?fieldMap.get(lastInspection.field_id)?.name||"Földtábla":"Még nincs szemle"}</div></div></article>
    </section>

    <section className={styles.content}>
      <div className={styles.left}>
        <article className={styles.panel}>
          <div className={styles.panelHead}><h2>Kezelt területek térképen</h2><Link href="/admin/clients">Teljes területnézet ↗</Link></div>
          <div className={styles.map}><div className={styles.mapTools}><span>+</span><span>−</span><span>▱</span></div>{visibleFields.map((f,i)=><Link title={f.name} href={`/fields/${f.id}`} key={f.id} className={`${styles.fieldShape} ${styles[`s${i+1}`]}`}><b>{i+1}</b></Link>)}</div>
          {visibleFields.length?<><table className={styles.fieldTable}><thead><tr><th>Tábla neve</th><th>Ügyfél</th><th>Növény</th><th>Terület</th><th>Utolsó szemle</th><th>Állapot</th></tr></thead><tbody>{visibleFields.slice(0,5).map((f,i)=>{const farm=farmMap.get(f.farm_id);const owner=ownerMap.get(farm?.owner_id);const last=latestInspectionFor(f.id);return <tr key={f.id}><td><Link href={`/fields/${f.id}`}><span className={styles.number}>{i+1}</span><strong>{f.name}</strong></Link></td><td>{owner?.full_name||farm?.name||"—"}</td><td>{f.current_crop||"—"}</td><td>{f.area_ha?`${f.area_ha} ha`:"—"}</td><td>{d(last?.inspected_at)}</td><td><span className={`${styles.status} ${last?.condition==="attention"?styles.warnStatus:last?.condition==="critical"?styles.dangerStatus:""}`}>{conditionLabel(last?.condition)}</span></td></tr>})}</tbody></table><div className={styles.mobileFieldList}>{visibleFields.slice(0,5).map(f=>{const last=latestInspectionFor(f.id);return <Link href={`/fields/${f.id}`} key={f.id} className={styles.mobileField}><div><strong>{f.name}</strong><small>{f.current_crop||"Nincs kultúra"} · {f.area_ha?`${f.area_ha} ha`:"—"}</small></div><span>{conditionLabel(last?.condition)}</span></Link>})}</div></>:<div className={styles.empty}>Még nincs rögzített földtábla.</div>}
          <div className={styles.panelFooter}><Link href="/admin/clients">Összes ügyfél és tábla megtekintése</Link></div>
        </article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Legutóbbi dokumentumok</h2><Link href="/admin/documents">Összes dokumentum</Link></div>{documents?.length?<div className={styles.docGrid}>{documents.map(doc=><Link href="/admin/documents" className={styles.doc} key={doc.id}><span>▤</span><div><strong>{doc.title}</strong><small>{d(doc.created_at)} · {fieldMap.get(doc.field_id)?.name||farmMap.get(doc.farm_id)?.name||"Gazdaság"}</small></div></Link>)}</div>:<div className={styles.empty}>Még nincs dokumentum.</div>}</article>
      </div>

      <div className={styles.right}>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Következő teendők</h2><Link href="/admin/tasks">Összes megnyitása</Link></div>{openTasks.length?<div className={styles.list}>{openTasks.slice(0,5).map(t=>{const days=daysUntil(t.due_date);const urgent=t.priority==="urgent"||t.priority==="high"||(days!==null&&days<=3);return <Link href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"} className={styles.row} key={t.id}><span className={`${styles.rowIcon} ${urgent?styles.warn:""}`}>{urgent?"!":"☑"}</span><div><strong>{t.title}</strong><small>{fieldMap.get(t.field_id)?.name||farmMap.get(t.farm_id)?.name||"Gazdaság"}</small></div><time>{days===null?"Nincs határidő":days<0?`${Math.abs(days)} napja lejárt`:days===0?"Ma":`${days} nap múlva`}<br/><em>{d(t.due_date)}</em></time></Link>})}</div>:<div className={styles.empty}>Nincs nyitott teendő.</div>}</article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Idővonal</h2><Link href="/admin/timeline">Teljes idővonal</Link></div>{timeline?.length?<div className={styles.timeline}>{timeline.slice(0,5).map(e=><div className={styles.event} key={e.id}><time>{d(e.event_at||e.created_at)}</time><div><strong>{eventLabel(e.event_type)}</strong><p>{e.description||e.title}</p>{e.field_id&&<small>{fieldMap.get(e.field_id)?.name||"Földtábla"}</small>}</div></div>)}</div>:<div className={styles.empty}>Még nincs esemény.</div>}</article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Bejelentések</h2><Link href="/admin/reports">Összes megnyitása</Link></div>{openReports.length?<div className={styles.list}>{openReports.slice(0,3).map(r=><Link href="/admin/reports" className={styles.row} key={r.id}><span className={`${styles.rowIcon} ${styles.warn}`}>!</span><div><strong>{r.title}</strong><small>{fieldMap.get(r.field_id)?.name||"Földtábla"}</small></div><time>{d(r.created_at)}</time></Link>)}</div>:<div className={styles.empty}>Nincs nyitott bejelentés.</div>}</article>
      </div>
    </section>
  </main>
}
