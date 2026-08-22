import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {ADVISOR_VISIT_EVENT,advisorVisitStatusLabel,decodeAdvisorVisit} from "@/lib/advisorVisits";
import {createAdvisorVisit,updateAdvisorVisitStatus} from "./actions";

function fmt(v:string|null|undefined){return v?new Date(v).toLocaleString("hu-HU",{dateStyle:"medium",timeStyle:"short"}):"—"}
function dateOnly(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}
function conditionLabel(v:string|null|undefined){if(v==="critical")return"Kritikus";if(v==="attention")return"Figyelmet igényel";if(v==="good")return"Jó állapot";return"Nincs szemle"}

export default async function AdminVisitsPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor")redirect("/dashboard");

  const[{data:farms},{data:fields},{data:visitEvents},{data:inspections},{data:tasks},{data:reports},{data:operations}]=await Promise.all([
    supabase.from("farms").select("id,name,owner_id,settlement").order("name"),
    supabase.from("fields").select("id,name,farm_id,current_crop,area_ha").order("name"),
    supabase.from("timeline_events").select("id,farm_id,field_id,title,description,event_at,created_at,created_by").eq("event_type",ADVISOR_VISIT_EVENT).eq("created_by",user.id).order("event_at",{ascending:true}).limit(300),
    supabase.from("inspections").select("id,field_id,condition,inspected_at,notes,recommendation,issue_status,next_check_at").order("inspected_at",{ascending:false}).limit(1000),
    supabase.from("tasks").select("id,farm_id,field_id,title,status,due_date,priority").neq("status","done").limit(1000),
    supabase.from("farmer_reports").select("id,field_id,title,status,created_at").neq("status","closed").limit(1000),
    supabase.from("timeline_events").select("id,farm_id,field_id,title,description,event_at,created_at").eq("event_type","field_operation").order("event_at",{ascending:false}).limit(1000),
  ]);

  const farmerIds=[...new Set((farms??[]).map(f=>f.owner_id))];
  const{data:farmers}=farmerIds.length?await supabase.from("profiles").select("id,full_name,phone").in("id",farmerIds):{data:[]};
  const ownerMap=new Map((farmers??[]).map(x=>[x.id,x]));
  const farmMap=new Map((farms??[]).map(x=>[x.id,x]));
  const fieldMap=new Map((fields??[]).map(x=>[x.id,x]));
  const today=new Date();today.setHours(0,0,0,0);
  const endWeek=new Date(today);endWeek.setDate(endWeek.getDate()+7);

  const visits=(visitEvents??[]).map(e=>({event:e,visit:decodeAdvisorVisit(e.description)})).filter((x):x is typeof x&{visit:NonNullable<typeof x.visit>}=>!!x.visit);
  const planned=visits.filter(x=>x.visit.status==="planned");
  const todayVisits=planned.filter(x=>{const d=new Date(x.visit.scheduledAt);return d>=today&&d<new Date(today.getTime()+86400000)});
  const weekVisits=planned.filter(x=>{const d=new Date(x.visit.scheduledAt);return d>=today&&d<=endWeek});
  const overdue=planned.filter(x=>new Date(x.visit.scheduledAt)<today);
  const completed=visits.filter(x=>x.visit.status==="completed").sort((a,b)=>new Date(b.visit.completedAt||b.visit.scheduledAt).getTime()-new Date(a.visit.completedAt||a.visit.scheduledAt).getTime());

  function prep(event:any){
    const farmFields=(fields??[]).filter(f=>f.farm_id===event.farm_id);
    const fieldIds=event.field_id?[event.field_id]:farmFields.map(f=>f.id);
    const lastInspection=(inspections??[]).find(i=>fieldIds.includes(i.field_id));
    const openTasks=(tasks??[]).filter(t=>(t.farm_id===event.farm_id||fieldIds.includes(t.field_id))&&t.status!=="done");
    const openReports=(reports??[]).filter(r=>fieldIds.includes(r.field_id)&&r.status!=="closed");
    const recentOperations=(operations??[]).filter(o=>o.farm_id===event.farm_id&&(!event.field_id||o.field_id===event.field_id)).slice(0,4);
    return{lastInspection,openTasks,openReports,recentOperations};
  }

  return <main className="admin-shell">
    <header className="admin-header">
      <div><span className="eyebrow">TEREPI MUNKASZERVEZÉS</span><h1>Szaktanácsadói látogatások</h1><p>Ügyféllátogatások előkészítése a korábbi szemlék, nyitott ügyek és gazdálkodói műveletek alapján.</p></div>
    </header>
    <AdminNav active="visits"/>

    <section className="admin-overview-grid">
      <article className="admin-overview-card"><span>Mai látogatás</span><strong>{todayVisits.length}</strong><small>mára tervezve</small></article>
      <article className="admin-overview-card"><span>Következő 7 nap</span><strong>{weekVisits.length}</strong><small>tervezett terepmunka</small></article>
      <article className="admin-overview-card"><span>Elmaradt</span><strong>{overdue.length}</strong><small>új időpontot igényel</small></article>
      <article className="admin-overview-card"><span>Elvégzett</span><strong>{completed.length}</strong><small>rögzített látogatás</small></article>
    </section>

    <section className="panel">
      <span className="eyebrow">ÚJ LÁTOGATÁS</span><h2>Terepi látogatás tervezése</h2>
      <form action={createAdvisorVisit} className="admin-form task-create-grid">
        <label>Ügyfél / gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms?.map(f=><option key={f.id} value={f.id}>{ownerMap.get(f.owner_id)?.full_name?`${ownerMap.get(f.owner_id)?.full_name} — `:""}{f.name}</option>)}</select></label>
        <label>Földtábla<select name="field_id"><option value="">Teljes gazdaság / több tábla</option>{fields?.map(f=><option key={f.id} value={f.id}>{farmMap.get(f.farm_id)?.name} — {f.name}</option>)}</select></label>
        <label>Időpont<input name="scheduled_at" type="datetime-local" required/></label>
        <label>Látogatás célja<input name="purpose" required placeholder="pl. visszaellenőrzés, állománybejárás"/></label>
        <label className="task-description">Megjegyzés<input name="note" placeholder="Mire kell külön figyelni?"/></label>
        <label className="checkbox-row"><input type="checkbox" name="notify_farmer" value="yes"/> Gazdálkodó értesítése</label>
        <button className="btn btn-primary">Látogatás rögzítése</button>
      </form>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">KÖVETKEZŐ TEREPMUNKÁK</span><h2>Felkészülési lista</h2></div><Link className="ghost-btn" href="/admin/portfolio">Ügyfélportfólió →</Link></div>
      <div style={{display:"grid",gap:12}}>{planned.length?planned.map(({event,visit})=>{
        const farm=farmMap.get(event.farm_id),field=event.field_id?fieldMap.get(event.field_id):null,owner=farm?ownerMap.get(farm.owner_id):null,p=prep(event),late=new Date(visit.scheduledAt)<today;
        return <article key={event.id} style={{border:`1px solid ${late?"#e3b7af":"#dfe5df"}`,borderRadius:14,padding:16,background:late?"#fff5f3":"#fff",display:"grid",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
            <div><span className="eyebrow">{late?"ELMARADT":"TERVEZVE"}</span><h3 style={{margin:"3px 0"}}>{visit.purpose}</h3><small>{fmt(visit.scheduledAt)} · {owner?.full_name||"Gazdálkodó"} · {farm?.name||"Gazdaság"}{field?` · ${field.name}`:""}</small>{visit.note&&<p style={{margin:"8px 0 0"}}>{visit.note}</p>}</div>
            <span className="user-pill">{advisorVisitStatusLabel(visit.status)}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
            <div className="stat-card"><span>Utolsó szemle</span><strong style={{fontSize:15}}>{dateOnly(p.lastInspection?.inspected_at)}</strong><small>{conditionLabel(p.lastInspection?.condition)}</small></div>
            <div className="stat-card"><span>Nyitott teendő</span><strong>{p.openTasks.length}</strong><small>{p.openTasks.filter(t=>t.due_date&&new Date(t.due_date)<today).length} lejárt</small></div>
            <div className="stat-card"><span>Bejelentés</span><strong>{p.openReports.length}</strong><small>gazdálkodói jelzés</small></div>
            <div className="stat-card"><span>Legutóbbi műveletek</span><strong>{p.recentOperations.length}</strong><small>felkészüléshez</small></div>
          </div>
          {p.recentOperations.length>0&&<div style={{background:"#f7f9f6",borderRadius:10,padding:10}}><strong style={{fontSize:12}}>Gazdálkodó által rögzített legutóbbi műveletek</strong><div style={{display:"grid",gap:4,marginTop:6}}>{p.recentOperations.map(o=><small key={o.id}>{dateOnly(o.event_at||o.created_at)} · {o.title}</small>)}</div></div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {event.field_id&&<><Link className="btn btn-primary" href={`/admin/inspections?field=${event.field_id}`}>Szemle indítása</Link><Link className="ghost-btn" href={`/fields/${event.field_id}`}>Tábla adatlapja</Link></>}
            {!event.field_id&&<Link className="btn btn-primary" href="/admin/priorities">Táblák áttekintése</Link>}
            <Link className="ghost-btn" href="/admin/map">Térkép</Link>
            <form action={updateAdvisorVisitStatus}><input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="status" value="completed"/><button className="ghost-btn">Látogatás elvégezve</button></form>
            <form action={updateAdvisorVisitStatus}><input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="status" value="cancelled"/><button className="ghost-btn">Lemondás</button></form>
          </div>
        </article>
      }):<div className="empty-state">Nincs tervezett terepi látogatás.</div>}</div>
    </section>

    {completed.length>0&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">ELŐZMÉNYEK</span><h2>Legutóbbi elvégzett látogatások</h2></div></div><div style={{display:"grid",gap:8}}>{completed.slice(0,10).map(({event,visit})=>{const farm=farmMap.get(event.farm_id),field=event.field_id?fieldMap.get(event.field_id):null;return <div className="task-admin-row" key={event.id}><span className="dot normal"/><div><strong>{visit.purpose}</strong><small>{farm?.name||"Gazdaság"}{field?` · ${field.name}`:""}</small></div><div><b>{dateOnly(visit.completedAt||visit.scheduledAt)}</b><small>Elvégezve</small></div></div>})}</div></section>}
  </main>;
}
