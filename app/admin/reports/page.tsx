import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {handleReport} from "../actions";

type SearchParams=Promise<{view?:string}>;
function reportStatus(v:string){if(v==="reviewed")return"Megválaszolva";if(v==="closed")return"Lezárva";return"Új"}

export default async function ReportsPage({searchParams}:{searchParams:SearchParams}){
 const{view="open"}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:reports},{data:fields},{data:farms},{data:farmers}]=await Promise.all([
  supabase.from("farmer_reports").select("id,field_id,title,message,status,created_at,advisor_reply,replied_at").order("created_at",{ascending:false}),
  supabase.from("fields").select("id,name,farm_id"),
  supabase.from("farms").select("id,name,owner_id"),
  supabase.from("profiles").select("id,full_name").eq("role","farmer")
 ]);
 const all=reports??[];
 const fresh=all.filter(r=>r.status!=="reviewed"&&r.status!=="closed");
 const answered=all.filter(r=>r.status==="reviewed");
 const closed=all.filter(r=>r.status==="closed");
 const visible=all.filter(r=>view==="new"?r.status!=="reviewed"&&r.status!=="closed":view==="answered"?r.status==="reviewed":view==="closed"?r.status==="closed":view==="all"?true:r.status!=="closed");
 const farmerName=(fieldId:string)=>{const field=fields?.find(f=>f.id===fieldId);const farm=farms?.find(f=>f.id===field?.farm_id);return farmers?.find(p=>p.id===farm?.owner_id)?.full_name||farm?.name||"Gazdálkodó"};
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI VEZÉRLŐPULT</span><h1>Bejelentések</h1><p>Gazdálkodói jelzések, válaszok, teendők és lezárások egy munkafolyamatban.</p></div></header>
  <AdminNav active="reports"/>
  <section className="stats-grid">
   <article className="stat-card"><span>Új</span><strong>{fresh.length}</strong><small>Válaszra vár</small></article>
   <article className="stat-card"><span>Megválaszolva</span><strong>{answered.length}</strong><small>Nyitott ügy</small></article>
   <article className="stat-card"><span>Nyitott összesen</span><strong>{fresh.length+answered.length}</strong><small>Aktív bejelentés</small></article>
   <article className="stat-card"><span>Lezárt</span><strong>{closed.length}</strong><small>Befejezett ügy</small></article>
  </section>
  <section className="panel">
   <div className="panel-heading"><div><span className="eyebrow">MUNKALISTA</span><h2>Bejelentések kezelése</h2></div><span className="user-pill">{visible.length} találat</span></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
    <Link className={view==="open"?"btn btn-primary":"ghost-btn"} href="/admin/reports?view=open">Nyitott ({fresh.length+answered.length})</Link>
    <Link className={view==="new"?"btn btn-primary":"ghost-btn"} href="/admin/reports?view=new">Új ({fresh.length})</Link>
    <Link className={view==="answered"?"btn btn-primary":"ghost-btn"} href="/admin/reports?view=answered">Megválaszolva ({answered.length})</Link>
    <Link className={view==="closed"?"btn btn-primary":"ghost-btn"} href="/admin/reports?view=closed">Lezárt ({closed.length})</Link>
    <Link className={view==="all"?"btn btn-primary":"ghost-btn"} href="/admin/reports?view=all">Összes ({all.length})</Link>
   </div>
   {visible.length?<div className="report-admin-list">{visible.map(r=>{const field=fields?.find(f=>f.id===r.field_id);return <div className="report-workflow-card" key={r.id}>
    <div className="report-workflow-head"><div><strong>{r.title}</strong><small>{farmerName(r.field_id)} · {field?.name||"Földtábla"} · {new Date(r.created_at).toLocaleString("hu-HU")}</small></div><span className={`report-status ${r.status}`}>{reportStatus(r.status)}</span></div>
    {r.message&&<p>{r.message}</p>}
    {r.advisor_reply&&<div className="recommendation"><b>Szaktanácsadói válasz</b><span>{r.advisor_reply}</span>{r.replied_at&&<small>{new Date(r.replied_at).toLocaleString("hu-HU")}</small>}</div>}
    <div className="report-actions"><Link className="ghost-btn" href={`/fields/${r.field_id}`}>Tábla megnyitása</Link>{r.status!=="closed"&&<form action={handleReport} className="report-reply-form"><input type="hidden" name="report_id" value={r.id}/><label>Válasz a gazdálkodónak<textarea name="reply" rows={3} placeholder="Szakmai válasz vagy javaslat..."/></label><div className="report-task-options"><input name="task_title" placeholder="Teendő neve (opcionális)"/><input name="due_date" type="date"/><select name="priority" defaultValue="normal"><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select></div><div className="report-buttons"><button className="btn btn-primary" name="action" value="reply">Válasz küldése</button><button className="btn btn-secondary" name="action" value="reply_task">Válasz + teendő</button><button className="ghost-btn" name="action" value="close" formNoValidate>Lezárás</button></div></form>}</div>
   </div>})}</div>:<div className="empty-state">Ebben a nézetben nincs bejelentés.</div>}
  </section>
 </main>
}
