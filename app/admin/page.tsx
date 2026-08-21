import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {NotificationBell} from "@/components/NotificationBell";
import styles from "./admin-dashboard.module.css";

function d(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function reportStatus(v:string|null){if(v==="closed")return"Lezárva";if(v==="reviewed")return"Megválaszolva";return"Új"}

export default async function AdminPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor")redirect("/dashboard");

  const[{data:farmers},{data:farms},{data:fields},{data:reports},{data:tasks},{data:inspections},{data:timeline},{data:documents}]=await Promise.all([
    supabase.from("profiles").select("id,full_name,phone").eq("role","farmer").order("full_name"),
    supabase.from("farms").select("id,name,owner_id,settlement").order("created_at",{ascending:false}),
    supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").order("created_at",{ascending:false}),
    supabase.from("farmer_reports").select("id,title,status,created_at,field_id").order("created_at",{ascending:false}).limit(30),
    supabase.from("tasks").select("id,title,status,due_date,field_id,farm_id,priority").order("due_date",{ascending:true}).limit(60),
    supabase.from("inspections").select("id,field_id,inspected_at,condition").order("inspected_at",{ascending:false}).limit(30),
    supabase.from("timeline_events").select("id,title,event_type,event_at,created_at,field_id").order("event_at",{ascending:false}).limit(6),
    supabase.from("documents").select("id,title,file_name,created_at,field_id,farm_id").order("created_at",{ascending:false}).limit(3),
  ]);

  const openReports=(reports??[]).filter(r=>r.status!=="closed");
  const openTasks=(tasks??[]).filter(t=>t.status!=="done");
  const totalArea=(fields??[]).reduce((s,f)=>s+Number(f.area_ha||0),0);
  const fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
  const farmMap=new Map((farms??[]).map(f=>[f.id,f]));
  const farmerRows=(farmers??[]).slice(0,6).map(f=>{const ownFarms=(farms??[]).filter(x=>x.owner_id===f.id);const farmIds=ownFarms.map(x=>x.id);const ownFields=(fields??[]).filter(x=>farmIds.includes(x.farm_id));const ownOpen=(tasks??[]).filter(t=>t.status!=="done"&&(farmIds.includes(t.farm_id)||ownFields.some(x=>x.id===t.field_id)));return{...f,farmCount:ownFarms.length,fieldCount:ownFields.length,taskCount:ownOpen.length}});
  const year=new Date().getFullYear();

  return <main className={styles.page}>
    <header className={styles.topbar}><div className={styles.welcome}><h1>Üdvözöljük, {me?.full_name||"Szaktanácsadó"}!</h1><p>Az ügyfelek, földterületek és szakmai feladatok aktuális állapota.</p></div><div className={styles.topActions}><NotificationBell/><div className={styles.year}>▣ {year}⌄</div></div></header>

    <section className={styles.stats}>
      <article className={styles.stat}><div className={styles.icon}>♙</div><div><div className={styles.label}>Aktív ügyfelek</div><div className={styles.value}>{farmers?.length??0}</div><div className={styles.meta}>{farms?.length??0} gazdaság</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>≋</div><div><div className={styles.label}>Kezelt terület</div><div className={styles.value}>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</div><div className={styles.meta}>{fields?.length??0} földtábla</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>☑</div><div><div className={styles.label}>Nyitott teendők</div><div className={styles.value}>{openTasks.length}</div><div className={styles.meta}>Kiadott feladat</div></div></article>
      <article className={styles.stat}><div className={styles.icon}>!</div><div><div className={styles.label}>Nyitott bejelentések</div><div className={styles.value}>{openReports.length}</div><div className={styles.meta}>{inspections?.length??0} rögzített szemle</div></div></article>
    </section>

    <section className={styles.content}>
      <div className={styles.left}>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Ügyfelek áttekintése</h2><Link href="/admin/clients">Összes ügyfél</Link></div>{farmerRows.length?<table className={styles.clientTable}><thead><tr><th>Gazdálkodó</th><th>Gazdaság</th><th>Táblák</th><th>Nyitott teendő</th><th>Állapot</th><th></th></tr></thead><tbody>{farmerRows.map(f=><tr key={f.id}><td><Link className={styles.clientLink} href={`/admin/clients/${f.id}`}><span className={styles.avatar}>{(f.full_name||"G").slice(0,2).toUpperCase()}</span>{f.full_name||"Névtelen ügyfél"}</Link></td><td>{f.farmCount}</td><td>{f.fieldCount}</td><td>{f.taskCount}</td><td><span className={styles.status}>Aktív</span></td><td><Link className={styles.action} href={`/admin/clients/${f.id}`}>Megnyitás →</Link></td></tr>)}</tbody></table>:<div className={styles.empty}>Még nincs ügyfél.</div>}</article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Gyors műveletek</h2><span/></div><div className={styles.quickGrid}><Link href="/admin/clients" className={styles.quick}><span>＋</span><strong>Új ügyfél / gazdaság</strong><small>Meghívás, gazdaság és tábla felvétele</small></Link><Link href="/admin/inspections" className={styles.quick}><span>⌖</span><strong>Új szemle</strong><small>Helyszíni szemle és szakmai javaslat</small></Link><Link href="/admin/tasks" className={styles.quick}><span>☑</span><strong>Teendő kiadása</strong><small>Határidő és prioritás beállításával</small></Link><Link href="/admin/documents" className={styles.quick}><span>▤</span><strong>Dokumentumtár</strong><small>Ügyféldokumentumok megnyitása és feltöltése</small></Link></div></article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Legutóbbi dokumentumok</h2><Link href="/admin/documents">Összes dokumentum</Link></div>{documents?.length?<div className={styles.docGrid}>{documents.map(doc=><Link href="/admin/documents" className={styles.doc} key={doc.id}><span>▤</span><div><strong>{doc.title}</strong><small>{d(doc.created_at)} · {fieldMap.get(doc.field_id)?.name||farmMap.get(doc.farm_id)?.name||"Gazdaság"}</small></div></Link>)}</div>:<div className={styles.empty}>Még nincs dokumentum.</div>}</article>
      </div>

      <div className={styles.right}>
        <article className={styles.panel}><div className={styles.panelHead}><h2>Következő teendők</h2><Link href="/admin/tasks">Összes megnyitása</Link></div>{openTasks.length?<div className={styles.list}>{openTasks.slice(0,5).map(t=><Link href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"} className={styles.row} key={t.id}><span className={`${styles.rowIcon} ${t.priority==="urgent"||t.priority==="high"?styles.warn:""}`}>{t.priority==="urgent"||t.priority==="high"?"!":"☑"}</span><div><strong>{t.title}</strong><small>{fieldMap.get(t.field_id)?.name||farmMap.get(t.farm_id)?.name||"Gazdaság"}</small></div><time>{t.due_date?d(t.due_date):"Nincs határidő"}</time></Link>)}</div>:<div className={styles.empty}>Nincs nyitott teendő.</div>}</article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Bejelentések</h2><Link href="/admin/reports">Összes megnyitása</Link></div>{reports?.length?<div className={styles.list}>{reports.slice(0,5).map(r=><Link href="/admin/reports" className={styles.row} key={r.id}><span className={`${styles.rowIcon} ${r.status==="new"?styles.warn:""}`}>!</span><div><strong>{r.title}</strong><small>{fieldMap.get(r.field_id)?.name||"Földtábla"} · {reportStatus(r.status)}</small></div><time>{d(r.created_at)}</time></Link>)}</div>:<div className={styles.empty}>Nincs bejelentés.</div>}</article>

        <article className={styles.panel}><div className={styles.panelHead}><h2>Legutóbbi események</h2><Link href="/admin/timeline">Teljes idővonal</Link></div>{timeline?.length?<div className={styles.timeline}>{timeline.map(e=><div className={styles.event} key={e.id}><time>{d(e.event_at||e.created_at)}</time><div><strong>{e.title}</strong><p>{fieldMap.get(e.field_id)?.name||"Gazdasági esemény"}</p></div></div>)}</div>:<div className={styles.empty}>Még nincs esemény.</div>}</article>
      </div>
    </section>
  </main>
}
