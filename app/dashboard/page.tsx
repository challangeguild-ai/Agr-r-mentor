import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {NotificationBell} from "@/components/NotificationBell";

function eventLabel(type:string|null){const map:Record<string,string>={inspection:"Szemle",task:"Teendő kiadva",task_completed:"Teendő elvégezve",farmer_report:"Bejelentés",advisor_reply:"Szaktanácsadói válasz",report_closed:"Bejelentés lezárva"};return map[type||""]||"Napló"}
function timeLabel(value:string){const d=new Date(value);const now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString("hu-HU",{hour:"2-digit",minute:"2-digit"});return d.toLocaleDateString("hu-HU",{month:"short",day:"numeric"})}

export default async function DashboardPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
  if(profile?.role==="advisor")redirect("/admin");
  const[{data:farms},{data:tasks},{data:timeline},{data:documents},{count:reports}]=await Promise.all([
    supabase.from("farms").select("id,name,settlement").order("created_at"),
    supabase.from("tasks").select("id,title,due_date,priority,status,field_id").order("due_date",{ascending:true}),
    supabase.from("timeline_events").select("id,event_type,title,description,event_at,created_at,field_id").order("event_at",{ascending:false}).limit(4),
    supabase.from("documents").select("id,title,category,file_name,created_at,field_id").order("created_at",{ascending:false}).limit(3),
    supabase.from("farmer_reports").select("id",{count:"exact",head:true}).eq("status","new"),
  ]);
  const farmIds=(farms??[]).map(f=>f.id);
  const{data:fields}=farmIds.length?await supabase.from("fields").select("id,name,area_ha,current_crop,crop_year,farm_id").in("farm_id",farmIds):{data:[]};
  const fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
  const openTasks=(tasks??[]).filter(t=>t.status!=="done"),doneTasks=(tasks??[]).filter(t=>t.status==="done");
  const name=profile?.full_name||"Gazdálkodó";

  return <div className="app-shell farmer-app"><Sidebar active="dashboard"/><main className="dashboard farmer-dashboard">
    <header className="portal-topbar"><div><span className="eyebrow">AGRÁR MENTOR</span><h1>Kezdőlap</h1><p>Üdvözöljük, {name}! Itt látja a gazdasága aktuális állapotát.</p></div><div className="portal-top-actions"><NotificationBell/><div className="portal-profile"><span>{name.slice(0,2).toUpperCase()}</span><strong>{name}</strong></div><Link className="portal-top-logout" href="/logout">↪ Kijelentkezés</Link></div></header>
    <section><h2 className="section-heading">Áttekintés</h2><div className="farmer-summary-grid"><Link href="/tasks" className="farmer-summary-card"><span>Teendők</span><strong>{openTasks.length}</strong><small>{doneTasks.length} elvégzett</small><b>☑</b></Link><Link href="/fields" className="farmer-summary-card"><span>Táblák</span><strong>{fields?.length??0}</strong><small>Aktív táblák</small><b>▱</b></Link><Link href="/timeline" className="farmer-summary-card"><span>Kapcsolattartás</span><strong>{reports??0}</strong><small>Új jelzés</small><b>◌</b></Link></div></section>
    <section className="farmer-main-grid"><article className="portal-card timeline-dashboard-card"><div className="portal-card-head"><h2>Idővonal</h2><Link href="/timeline">Összes esemény →</Link></div>{timeline?.length?<div className="farmer-timeline-list">{timeline.map(e=>{const field=fieldMap.get(e.field_id);return <div className="farmer-timeline-item" key={e.id}><span className={`farmer-timeline-dot ${e.event_type||""}`}/><div><div className="farmer-timeline-meta"><span>{eventLabel(e.event_type)}</span><time>{timeLabel(e.event_at||e.created_at)}</time></div><strong>{e.title}</strong>{e.description&&<p>{e.description}</p>}{field&&<Link href={`/fields/${field.id}`}>Földtábla megnyitása →</Link>}</div></div>})}</div>:<div className="empty-state">Még nincs esemény.</div>}</article><div className="farmer-side-stack"><article className="portal-card"><div className="portal-card-head"><h2>Következő teendők</h2><Link href="/tasks">Összes →</Link></div>{openTasks.length?openTasks.slice(0,4).map(t=><div className="mini-list-row" key={t.id}><span className="mini-check"/><div><strong>{t.title}</strong><small>{t.field_id?fieldMap.get(t.field_id)?.name||"Földtábla":"Gazdaság"}</small></div><time>{t.due_date?new Date(t.due_date).toLocaleDateString("hu-HU",{month:"short",day:"numeric"}):"—"}</time></div>):<div className="empty-state compact">Nincs nyitott teendő.</div>}</article><article className="portal-card"><div className="portal-card-head"><h2>Legutóbbi dokumentumok</h2><Link href="/documents">Összes →</Link></div>{documents?.length?documents.map(d=><div className="mini-doc-row" key={d.id}><span>▤</span><div><strong>{d.title}</strong><small>{d.file_name}</small></div><time>{new Date(d.created_at).toLocaleDateString("hu-HU")}</time></div>):<div className="empty-state compact">Még nincs dokumentum.</div>}</article></div></section>
  </main></div>
}
