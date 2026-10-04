import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import styles from "./field-detail.module.css";
import {InspectionMedia} from "@/components/InspectionMedia";
import {FarmerReportForm} from "@/components/FarmerReportForm";
import {FarmerReportMedia} from "@/components/FarmerReportMedia";
import {FieldMapEditor} from "@/components/FieldMapEditor";
import {completeTask} from "./actions";

function formatDate(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function conditionLabel(v:string|null|undefined){if(v==="good")return"Jó állapot";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}
function statusLabel(v:string|null|undefined){if(v==="inactive")return"Inaktív";if(v==="archived")return"Archivált";return"Aktív"}
function followLabel(v:string|null|undefined){if(v==="improved")return"↑ Javult";if(v==="unchanged")return"→ Változatlan";if(v==="worsened")return"↓ Romlott";return null}
function issueLabel(v:string|null|undefined){if(v==="resolved")return"Lezárt";if(v==="monitoring")return"Megfigyelés alatt";return"Nyitott"}
function eventTypeLabel(v:string|null|undefined){const m:Record<string,string>={inspection:"Szemle",inspection_followup:"Visszaellenőrzés",task:"Teendő",task_completed:"Teendő elvégezve",farmer_report:"Gazdálkodói bejelentés",advisor_reply:"Szaktanácsadói válasz",report_closed:"Bejelentés lezárva",field_operation:"Gazdálkodási művelet",field_hotspot:"GPS problémagóc"};return m[v||""]||"Napló"}
function reportStatus(v:string){if(v==="reviewed")return"Megválaszolva";if(v==="closed")return"Lezárva";return"Új"}
function hotspotFromEvent(e:any){if(e?.event_type!=="field_hotspot")return null;const m=String(e.description||"").match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);if(!m)return null;const text=String(e.description||"").toLowerCase();return{lat:Number(m[1]),lng:Number(m[2]),title:e.title||"GPS problémagóc",description:e.description||null,severity:(text.includes("kritikus")?"critical":text.includes("figyel")?"attention":"good") as "critical"|"attention"|"good"}}

export default async function FieldDetailPage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");

  const[{data:profile},{data:field}]=await Promise.all([
    supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle(),
    supabase.from("fields").select("id,farm_id,name,area_ha,current_crop,crop_year,sowing_date,status,notes,center_lat,center_lng,boundary_geojson").eq("id",id).maybeSingle()
  ]);
  if(profile?.system_role==="admin")redirect("/system-admin");
  if(!field)notFound();

  const[{data:farm},{data:tasks},{data:inspections},{data:timeline},{data:reports},{data:documents},{data:weather}]=await Promise.all([
    supabase.from("farms").select("name,settlement,address").eq("id",field.farm_id).maybeSingle(),
    supabase.from("tasks").select("id,title,description,due_date,priority,status,created_at,assigned_to,completed_at").eq("field_id",id).order("created_at",{ascending:false}),
    supabase.from("inspections").select("id,inspected_at,condition,notes,recommendation,created_at,follow_up_status,next_check_at,issue_status,previous_inspection_id").eq("field_id",id).order("inspected_at",{ascending:false}),
    supabase.from("timeline_events").select("id,event_type,title,description,event_at,created_at").eq("field_id",id).order("event_at",{ascending:false}),
    supabase.from("farmer_reports").select("id,title,message,status,created_at,advisor_reply,replied_at,closed_at").eq("field_id",id).order("created_at",{ascending:false}),
    supabase.from("documents").select("id,title,category,file_name,created_at,file_size").eq("field_id",id).order("created_at",{ascending:false}).limit(8),
    supabase.from("field_weather_daily").select("id,weather_date,source_type,provider,station_number,station_name,distance_km,precipitation_mm,temperature_min_c,temperature_max_c,source_url,fetched_at").eq("field_id",id).order("weather_date",{ascending:false}).limit(35)
  ]);

  const inspectionIds=(inspections??[]).map(i=>i.id);
  const reportIds=(reports??[]).map(r=>r.id);
  const[{data:media},{data:reportMedia}]=await Promise.all([
    inspectionIds.length?supabase.from("inspection_media").select("id,inspection_id,storage_path,file_name,media_type").in("inspection_id",inspectionIds).order("created_at"):Promise.resolve({data:[]}),
    reportIds.length?supabase.from("farmer_report_media").select("id,report_id,storage_path,file_name,media_type").in("report_id",reportIds).order("created_at"):Promise.resolve({data:[]})
  ]);

  const openTasks=(tasks??[]).filter(t=>t.status!=="done");
  const latestInspection=(inspections??[])[0];
  const weatherRows=weather??[];
  const weatherAge=(date:string)=>Math.floor((Date.now()-new Date(date+"T12:00:00").getTime())/86400000);
  const rain7=weatherRows.filter(w=>weatherAge(w.weather_date)<=7).reduce((s,w)=>s+Number(w.precipitation_mm||0),0);
  const rain30=weatherRows.filter(w=>weatherAge(w.weather_date)<=30).reduce((s,w)=>s+Number(w.precipitation_mm||0),0);
  const lastRain=weatherRows.find(w=>Number(w.precipitation_mm)>0);
  const openReports=(reports??[]).filter(r=>r.status!=="closed");
  const operations=(timeline??[]).filter(x=>x.event_type==="field_operation");
  const hotspots=(timeline??[]).map(hotspotFromEvent).filter(Boolean) as {lat:number;lng:number;title:string;description?:string|null;severity?:"attention"|"critical"|"good"}[];
  const events=[
    ...(tasks??[]).map(x=>({id:`t-${x.id}`,type:"Teendő",title:x.title,description:x.description||"Kiadott feladat.",date:x.created_at})),
    ...(timeline??[]).map(x=>({id:`e-${x.id}`,type:eventTypeLabel(x.event_type),title:x.title,description:x.description||"",date:x.event_at||x.created_at})),
    ...(reports??[]).map(r=>({id:`r-${r.id}`,type:"Gazdálkodói bejelentés",title:r.title,description:r.message||"Bejelentés érkezett a gazdálkodótól.",date:r.created_at}))
  ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

  const operationHref=profile?.role==="advisor"?`/admin/operations?field=${field.id}`:`/operations?field=${field.id}`;

  return <div className="app-shell farmer-app">
    <Sidebar active="fields" userName={profile?.full_name||"Gazdálkodó"}/>
    <main className={`dashboard ${styles.page}`}>
      <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés táblák, műveletek vagy dokumentumok között…"/>
      <section className={styles.fieldHero}>
       <div className={styles.fieldHeroMain}><Link href="/fields">← Táblák</Link><span>FÖLDTÁBLA</span><h1>{field.name}</h1><p>{field.area_ha?`${field.area_ha} ha`:"—"} · {field.current_crop||"Nincs kultúra"} · {farm?.name||"Gazdaság"}</p></div>
       <div className={styles.fieldHeroState}><span className={latestInspection?.condition==="critical"?styles.stateCritical:latestInspection?.condition==="attention"?styles.stateAttention:styles.stateGood}>{conditionLabel(latestInspection?.condition)}</span><Link href={operationHref}>Művelet rögzítése →</Link></div>
      </section>

      <nav className={styles.tabs}><a href="#attekintes">Áttekintés</a><a href="#muveletek">Műveletek</a><a href="#idojaras">Időjárás</a><a href="#dokumentumok">Dokumentumok</a><a href="#terkep">Térkép</a></nav>

      <section className={styles.stats}>
       <article><span>▣</span><div><strong>{field.area_ha?`${field.area_ha} ha`:"—"}</strong><small>Terület</small></div></article>
       <article><span>◆</span><div><strong>{field.current_crop||"—"}</strong><small>Növény</small></div></article>
       <article><span>●</span><div><strong>{statusLabel(field.status)}</strong><small>Státusz</small></div></article>
       <article><span>▤</span><div><strong>{formatDate(latestInspection?.inspected_at)}</strong><small>Utolsó szemle</small></div></article>
      </section>

      <section id="attekintes" className={styles.overviewGrid}>
       <article className={styles.infoCard}><h2>Tábla adatok</h2><dl><div><dt>Gazdaság</dt><dd>{farm?.name||"—"}</dd></div><div><dt>Kataszter</dt><dd>{farm?.settlement||"—"}</dd></div><div><dt>Gazdasági év</dt><dd>{field.crop_year||"—"}</dd></div><div><dt>Vetés</dt><dd>{formatDate(field.sowing_date)}</dd></div><div><dt>Megjegyzés</dt><dd>{field.notes||"—"}</dd></div></dl></article>
       <article id="terkep" className={styles.mapCard}><div className={styles.cardTitle}><h2>Térképi nézet</h2><span>{field.area_ha?field.area_ha+" ha":""}</span></div><FieldMapEditor fieldId={field.id} lat={field.center_lat} lng={field.center_lng} boundary={field.boundary_geojson} editable={false} hotspots={hotspots} compact/></article>
       <article className={styles.healthCard}><div><h2>Aktuális állapot</h2><div className={styles.healthRing}><strong>{latestInspection?.condition==="good"?"72":latestInspection?.condition==="attention"?"48":latestInspection?.condition==="critical"?"24":"—"}%</strong></div></div><dl><div><dt>Növényállapot</dt><dd>{conditionLabel(latestInspection?.condition)}</dd></div><div><dt>7 nap csapadék</dt><dd>{rain7.toLocaleString("hu-HU",{maximumFractionDigits:1})} mm</dd></div><div><dt>30 nap csapadék</dt><dd>{rain30.toLocaleString("hu-HU",{maximumFractionDigits:1})} mm</dd></div><div><dt>Nyitott ügyek</dt><dd>{openTasks.length+openReports.length}</dd></div></dl></article>
      </section>

      <section id="idojaras" className={`panel ${styles.sectionPanel}`} style={{marginTop:14}}>
       <div className="panel-heading"><div><span className="eyebrow">HIVATALOS METEOROLÓGIAI ELŐZMÉNY</span><h2>Csapadék a tábla környezetében</h2></div>{lastRain?.source_url&&<a className="ghost-btn" href={lastRain.source_url} target="_blank" rel="noreferrer">HungaroMet forrás ↗</a>}</div>
       <div className="field-detail-stats" style={{margin:"14px 0 0"}}>
        <article className="stat-card"><span>Utolsó 7 nap</span><strong>{rain7.toLocaleString("hu-HU",{maximumFractionDigits:1})} mm</strong><small>MÉRT állomási adat</small></article>
        <article className="stat-card"><span>Utolsó 30 nap</span><strong>{rain30.toLocaleString("hu-HU",{maximumFractionDigits:1})} mm</strong><small>HungaroMet automata állomás</small></article>
        <article className="stat-card"><span>Utolsó mért csapadék</span><strong className="field-stat-text">{lastRain?Number(lastRain.precipitation_mm).toLocaleString("hu-HU",{maximumFractionDigits:1})+" mm":"—"}</strong><small>{lastRain?formatDate(lastRain.weather_date):"Még nincs szinkronizált adat"}</small></article>
        <article className="stat-card"><span>Adatforrás</span><strong className="field-stat-text">{lastRain?.station_name||"—"}</strong><small>{lastRain?("MÉRT · "+Number(lastRain.distance_km||0).toLocaleString("hu-HU",{maximumFractionDigits:1})+" km a táblától"):"A szinkron után jelenik meg"}</small></article>
       </div>
       {weatherRows.length>0&&<div className="task-list" style={{marginTop:14}}>{weatherRows.filter(w=>Number(w.precipitation_mm)>0).slice(0,8).map(w=><div className="task-row" key={w.id}><span className="dot normal"/><div><strong>🌧 {Number(w.precipitation_mm).toLocaleString("hu-HU",{maximumFractionDigits:1})} mm</strong><small>{formatDate(w.weather_date)} · {w.provider} · {w.station_name||w.station_number||"állomás"} · {Number(w.distance_km||0).toLocaleString("hu-HU",{maximumFractionDigits:1})} km</small></div><span className="task-status">{w.source_type==="measured"?"MÉRT":w.source_type==="calculated"?"SZÁMÍTOTT":"ELŐREJELZETT"}</span></div>)}</div>}
      </section>

      {profile?.role!=="advisor"&&<section className="panel farmer-report-panel"><span className="eyebrow">KAPCSOLAT A SZAKTANÁCSADÓVAL</span><h2>Bejelentés küldése</h2><FarmerReportForm fieldId={field.id}/></section>}

      <section className="field-detail-grid"><article className="panel"><span className="eyebrow">SZAKTANÁCSADÁS</span><h2>Szemlék és javaslatok</h2>{inspections?.length?<div className="inspection-list">{inspections.map(i=>{const follow=followLabel(i.follow_up_status);return <div className="inspection-card" key={i.id}><div className="inspection-head"><div><strong>{conditionLabel(i.condition)}</strong><small>{formatDate(i.inspected_at)}</small></div><span className="event-badge">{i.previous_inspection_id?"Visszaellenőrzés":"Szemle"}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"8px 0"}}>{follow&&<span className="user-pill">{follow}</span>}<span className="user-pill">{issueLabel(i.issue_status)}</span>{i.next_check_at&&<span className="user-pill">Következő: {formatDate(i.next_check_at)}</span>}</div>{i.notes&&<p>{i.notes}</p>}{i.recommendation&&<div className="recommendation"><b>Szaktanácsadói javaslat</b><span>{i.recommendation}</span></div>}<InspectionMedia items={(media??[]).filter((m:any)=>m.inspection_id===i.id) as any}/></div>})}</div>:<div className="empty-state">Ehhez a táblához még nincs rögzített szemle.</div>}</article><article className="panel"><span className="eyebrow">GAZDÁLKODÓI JELZÉSEK</span><h2>Bejelentések</h2>{reports?.length?<div className="inspection-list">{reports.map(r=><div className="inspection-card" key={r.id}><div className="inspection-head"><div><strong>{r.title}</strong><small>{formatDate(r.created_at)}</small></div><span className="event-badge">{reportStatus(r.status)}</span></div>{r.message&&<p>{r.message}</p>}<FarmerReportMedia items={(reportMedia??[]).filter((m:any)=>m.report_id===r.id) as any}/>{r.advisor_reply&&<div className="recommendation"><b>Szaktanácsadói válasz · {formatDate(r.replied_at)}</b><span>{r.advisor_reply}</span></div>}</div>)}</div>:<div className="empty-state">Még nincs gazdálkodói bejelentés.</div>}</article></section>

      <section id="muveletek" className="panel"><div className="panel-heading"><div><span className="eyebrow">GAZDÁLKODÁSI NAPLÓ</span><h2>Táblaműveletek</h2></div><Link className="ghost-btn" href={operationHref}>Műveleti napló →</Link></div>{operations.length?<div className="task-list">{operations.slice(0,6).map(o=><div className="task-row" key={o.id}><span className="dot normal"/><div><strong>{o.title}</strong><small>{formatDate(o.event_at||o.created_at)}{o.description?` · ${o.description}`:""}</small></div><span className="task-status">Napló</span></div>)}</div>:<div className="empty-state">Ehhez a táblához még nincs rögzített gazdálkodási művelet.</div>}</section>

      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">FELADATOK</span><h2>Teendők</h2></div><Link className="ghost-btn" href={profile?.role==="advisor"?`/admin/tasks?farm=${field.farm_id}&field=${field.id}`:"/tasks"}>Teljes munkalista →</Link></div>{tasks?.length?<div className="task-list">{tasks.map(t=><div className="task-row" key={t.id}><span className={`dot ${t.priority}`}/><div><strong>{t.title}</strong><small>{t.due_date?`Határidő: ${formatDate(t.due_date)}`:"Nincs határidő"}{t.description?` · ${t.description}`:""}{t.completed_at?` · Elvégezve: ${formatDate(t.completed_at)}`:""}</small></div>{t.status==="done"?<span className="task-status">Kész ✓</span>:profile?.role!=="advisor"&&t.assigned_to===user.id?<form action={completeTask}><input type="hidden" name="task_id" value={t.id}/><button className="ghost-btn" type="submit">Készre jelölöm</button></form>:<span className="task-status">Nyitott</span>}</div>)}</div>:<div className="empty-state">Nincs ehhez a táblához kiadott teendő.</div>}</section>

      <section id="dokumentumok" className="panel"><div className="panel-heading"><div><span className="eyebrow">IRATTÁR</span><h2>Kapcsolódó dokumentumok</h2></div><Link className="ghost-btn" href={profile?.role==="advisor"?"/admin/documents":"/documents"}>Dokumentumtár →</Link></div>{documents?.length?<div className="field-document-grid">{documents.map(doc=><Link className="field-document-card" href={profile?.role==="advisor"?"/admin/documents":"/documents"} key={doc.id}><span>▤</span><div><strong>{doc.title}</strong><small>{doc.category||"Dokumentum"} · {formatDate(doc.created_at)}</small></div></Link>)}</div>:<div className="empty-state">Ehhez a táblához még nincs dokumentum csatolva.</div>}</section>

      <section className="panel field-timeline-panel"><span className="eyebrow">NAPLÓ</span><h2>Tábla idővonala</h2>{events.length?<div className="timeline-list">{events.map(e=><div className="timeline-item" key={e.id}><span className="timeline-dot"/><div className="timeline-content"><div className="timeline-meta"><span className="event-badge">{e.type}</span><time>{formatDate(e.date)}</time></div><strong>{e.title}</strong>{e.description&&<p>{e.description}</p>}</div></div>)}</div>:<div className="empty-state">A tábla idővonala még üres.</div>}</section>
    </main>
  </div>;
}
