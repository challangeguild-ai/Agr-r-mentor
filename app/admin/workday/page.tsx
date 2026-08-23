import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {ADVISOR_VISIT_EVENT,decodeAdvisorVisit} from "@/lib/advisorVisits";

function dayKey(v:string|Date){const d=typeof v==="string"?new Date(v):v;return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function fmtDate(v:string|null|undefined){return v?new Intl.DateTimeFormat("hu-HU",{timeZone:"Europe/Budapest",month:"short",day:"numeric"}).format(new Date(v)):"—"}
function fmtTime(v:string|null|undefined){return v?new Intl.DateTimeFormat("hu-HU",{timeZone:"Europe/Budapest",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):""}
function addDays(base:Date,n:number){const d=new Date(base);d.setDate(d.getDate()+n);return d}
function tone(priority:string|null|undefined){return priority==="urgent"||priority==="high"?"#a72f27":"#39752f"}

type SP=Promise<{day?:string}>;
export default async function AdvisorWorkdayPage({searchParams}:{searchParams:SP}){
 const sp=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farms},{data:fields},{data:tasks},{data:inspections},{data:reports},{data:visitEvents}]=await Promise.all([
  supabase.from("farms").select("id,name,owner_id,settlement").order("name"),
  supabase.from("fields").select("id,name,farm_id,current_crop,area_ha,center_lat,center_lng").order("name"),
  supabase.from("tasks").select("id,title,description,due_date,status,priority,farm_id,field_id,assigned_to").neq("status","done").order("due_date",{ascending:true,nullsFirst:false}).limit(500),
  supabase.from("inspections").select("id,field_id,inspected_at,condition,next_check_at,issue_status,recommendation").neq("issue_status","resolved").order("next_check_at",{ascending:true,nullsFirst:false}).limit(500),
  supabase.from("farmer_reports").select("id,title,status,created_at,field_id,message").neq("status","closed").order("created_at",{ascending:false}).limit(250),
  supabase.from("timeline_events").select("id,farm_id,field_id,description,event_at").eq("event_type",ADVISOR_VISIT_EVENT).eq("created_by",user.id).order("event_at",{ascending:true}).limit(300)
 ]);
 const farmMap=new Map((farms??[]).map(f=>[f.id,f])),fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
 const ownerIds=[...new Set((farms??[]).map(f=>f.owner_id))];const{data:clients}=ownerIds.length?await supabase.from("profiles").select("id,full_name,phone").in("id",ownerIds):{data:[]};const clientMap=new Map((clients??[]).map(c=>[c.id,c]));
 const now=new Date(),today=dayKey(now),selected=/^\d{4}-\d{2}-\d{2}$/.test(sp.day||"")?sp.day!:today;
 const weekDays=Array.from({length:7},(_,i)=>dayKey(addDays(now,i)));
 const visits=(visitEvents??[]).map(e=>({event:e,visit:decodeAdvisorVisit(e.description)})).filter((x):x is typeof x&{visit:NonNullable<typeof x.visit>}=>!!x.visit&&x.visit.status==="planned");
 const dueTasks=(tasks??[]).filter(t=>t.due_date&&t.due_date<=selected),selectedTasks=(tasks??[]).filter(t=>t.due_date===selected),unscheduledTasks=(tasks??[]).filter(t=>!t.due_date);
 const dueChecks=(inspections??[]).filter(i=>i.next_check_at&&i.next_check_at<=selected),selectedChecks=(inspections??[]).filter(i=>i.next_check_at===selected);
 const selectedVisits=visits.filter(v=>dayKey(v.visit.scheduledAt)===selected);
 const overdueCount=(tasks??[]).filter(t=>t.due_date&&t.due_date<today).length+(inspections??[]).filter(i=>i.next_check_at&&i.next_check_at<today).length+visits.filter(v=>dayKey(v.visit.scheduledAt)<today).length;
 const criticalFields=new Set((inspections??[]).filter(i=>i.condition==="critical"&&i.issue_status!=="resolved").map(i=>i.field_id));
 const selectedItems=selectedTasks.length+selectedChecks.length+selectedVisits.length;
 const clientForFarm=(farmId:string|null|undefined)=>{const f=farmId?farmMap.get(farmId):null;return f?clientMap.get(f.owner_id):null};
 const fieldFor=(id:string|null|undefined)=>id?fieldMap.get(id):null;
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">NAPI MUNKAKÖZPONT</span><h1>Szaktanácsadói munkanap</h1><p>{me.full_name||"Szaktanácsadó"} · szemlék, feladatok, látogatások és beérkező ügyek egyetlen munkafolyamatban.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className="btn btn-primary" href="/admin/inspections">+ Szemle</Link><Link className="btn btn-secondary" href="/admin/tasks">+ Feladat</Link><Link className="btn btn-secondary" href="/admin/visits">+ Látogatás</Link></div></header>
  <AdminNav active="workday"/>
  <section className="admin-overview-grid"><article className="admin-overview-card"><span>Kiválasztott nap</span><strong>{selectedItems}</strong><small>tervezett szakmai esemény</small></article><article className="admin-overview-card"><span>Lejárt / elmaradt</span><strong>{overdueCount}</strong><small>rendezést igényel</small></article><article className="admin-overview-card"><span>Nyitott jelzés</span><strong>{reports?.length??0}</strong><small>gazdálkodói bejelentés</small></article><article className="admin-overview-card"><span>Kritikus tábla</span><strong>{criticalFields.size}</strong><small>aktív szakmai probléma</small></article></section>
  <section className="panel" style={{marginBottom:14}}><div className="panel-heading"><div><span className="eyebrow">KÖVETKEZŐ 7 NAP</span><h2>Heti munkasáv</h2></div><Link className="ghost-btn" href="/admin/priorities">Prioritások →</Link></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(100px,1fr))",gap:8,padding:14,overflowX:"auto"}}>{weekDays.map(k=>{const taskCount=(tasks??[]).filter(t=>t.due_date===k).length,checkCount=(inspections??[]).filter(i=>i.next_check_at===k).length,visitCount=visits.filter(v=>dayKey(v.visit.scheduledAt)===k).length,total=taskCount+checkCount+visitCount;return <Link key={k} href={`/admin/workday?day=${k}`} style={{minWidth:100,textDecoration:"none",border:selected===k?"2px solid #174a32":"1px solid #dfe5df",borderRadius:13,padding:12,background:selected===k?"#eef5ec":"#fff",color:"inherit"}}><strong style={{display:"block",fontSize:13}}>{k===today?"Ma":fmtDate(`${k}T12:00:00`)}</strong><span style={{display:"block",fontSize:26,fontWeight:900,color:"#174a32",margin:"5px 0"}}>{total}</span><small style={{display:"block",color:"#6f7c74",lineHeight:1.45}}>{taskCount} feladat<br/>{checkCount} szemle<br/>{visitCount} látogatás</small></Link>})}</div></section>
  <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.55fr) minmax(300px,.75fr)",gap:14,alignItems:"start"}}>
   <div style={{display:"grid",gap:14}}>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">{selected===today?"MA":"KIVÁLASZTOTT NAP"}</span><h2>{fmtDate(`${selected}T12:00:00`)} munkaterve</h2></div><span className="user-pill">{selectedItems} esemény</span></div><div style={{display:"grid",gap:10,padding:14}}>
     {selectedVisits.map(({event,visit})=>{const farm=farmMap.get(event.farm_id),field=fieldFor(event.field_id),client=clientForFarm(event.farm_id);return <article key={`v-${event.id}`} style={{border:"1px solid #dfe5df",borderLeft:"4px solid #174a32",borderRadius:12,padding:14,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><small style={{fontWeight:900,color:"#174a32"}}>LÁTOGATÁS · {fmtTime(visit.scheduledAt)}</small><h3 style={{margin:"4px 0"}}>{visit.purpose}</h3><p style={{margin:0,color:"#6f7c74"}}>{client?.full_name||"Ügyfél"} · {farm?.name||"Gazdaság"}{field?` · ${field.name}`:""}</p></div><Link className="ghost-btn" href="/admin/visits">Megnyitás</Link></div></article>})}
     {selectedChecks.map(i=>{const field=fieldFor(i.field_id),farm=field?farmMap.get(field.farm_id):null,client=clientForFarm(farm?.id);return <article key={`i-${i.id}`} style={{border:"1px solid #dfe5df",borderLeft:`4px solid ${i.condition==="critical"?"#a72f27":"#b77700"}`,borderRadius:12,padding:14,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><small style={{fontWeight:900,color:i.condition==="critical"?"#a72f27":"#8a6300"}}>VISSZAELLENŐRZÉS</small><h3 style={{margin:"4px 0"}}>{field?.name||"Földtábla"}</h3><p style={{margin:0,color:"#6f7c74"}}>{client?.full_name||"Ügyfél"} · {farm?.name||"Gazdaság"}{i.recommendation?` · ${i.recommendation}`:""}</p></div><Link className="btn btn-primary" href={`/admin/inspections?field=${i.field_id}`}>Szemle indítása</Link></div></article>})}
     {selectedTasks.map(t=>{const field=fieldFor(t.field_id),farm=farmMap.get(t.farm_id),client=clientForFarm(t.farm_id);return <article key={`t-${t.id}`} style={{border:"1px solid #dfe5df",borderLeft:`4px solid ${tone(t.priority)}`,borderRadius:12,padding:14,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><small style={{fontWeight:900,color:tone(t.priority)}}>FELADAT · {String(t.priority||"normal").toUpperCase()}</small><h3 style={{margin:"4px 0"}}>{t.title}</h3><p style={{margin:0,color:"#6f7c74"}}>{client?.full_name||"Ügyfél"} · {farm?.name||"Gazdaság"}{field?` · ${field.name}`:""}</p></div><Link className="ghost-btn" href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"}>Megnyitás</Link></div></article>})}
     {!selectedItems&&<div className="empty-state">Erre a napra nincs ütemezett szakmai esemény.</div>}
    </div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">BEÉRKEZŐ ÜGYEK</span><h2>Gazdálkodói jelzések</h2></div><Link className="ghost-btn" href="/admin/reports">Összes →</Link></div><div style={{display:"grid",gap:8,padding:14}}>{(reports??[]).slice(0,8).map(r=>{const field=fieldFor(r.field_id),farm=field?farmMap.get(field.farm_id):null,client=clientForFarm(farm?.id);return <Link key={r.id} href={r.field_id?`/fields/${r.field_id}`:"/admin/reports"} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,padding:12,border:"1px solid #e2e6e1",borderRadius:10,textDecoration:"none",color:"inherit"}}><div><strong>{r.title}</strong><small style={{display:"block",marginTop:3,color:"#6f7c74"}}>{client?.full_name||"Ügyfél"} · {field?.name||"Földtábla"}</small></div><small>{fmtDate(r.created_at)}</small></Link>})}{!(reports?.length)&&<div className="empty-state">Nincs nyitott gazdálkodói jelzés.</div>}</div></section>
   </div>
   <aside style={{display:"grid",gap:14}}>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AZONNALI RENDEZÉS</span><h2>Elmaradások</h2></div></div><div style={{display:"grid",gap:8,padding:14}}>{dueTasks.filter(t=>t.due_date&&t.due_date<today).slice(0,6).map(t=><Link key={t.id} className="ghost-btn" href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"}>! {t.title} · {fmtDate(t.due_date)}</Link>)}{dueChecks.filter(i=>i.next_check_at&&i.next_check_at<today).slice(0,6).map(i=><Link key={i.id} className="ghost-btn" href={`/admin/inspections?field=${i.field_id}`}>◉ {fieldFor(i.field_id)?.name||"Tábla"} · {fmtDate(i.next_check_at)}</Link>)}{!overdueCount&&<div className="empty-state">Nincs elmaradt tétel.</div>}</div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">NINCS DÁTUMHOZ KÖTVE</span><h2>Szabad feladatok</h2></div></div><div style={{display:"grid",gap:8,padding:14}}>{unscheduledTasks.slice(0,8).map(t=><Link key={t.id} className="ghost-btn" href={t.field_id?`/fields/${t.field_id}`:"/admin/tasks"}>{t.title}</Link>)}{!unscheduledTasks.length&&<div className="empty-state">Nincs dátum nélküli feladat.</div>}</div></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">TEREPI SEGÍTSÉG</span><h2>Gyors elérés</h2></div></div><div style={{display:"grid",gap:8,padding:14}}><Link className="btn btn-primary" href="/admin/map">Térkép megnyitása</Link><Link className="btn btn-secondary" href="/admin/clients">Ügyfél kiválasztása</Link><Link className="btn btn-secondary" href="/admin/documents">Dokumentumtár</Link></div></section>
   </aside>
  </section>
 </main>
}
