import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";

type SearchParams=Promise<{view?:string}>;
function statusLabel(v:string){if(v==="reviewed")return"Megválaszolva";if(v==="closed")return"Lezárva";return"Új"}

export default async function MessagesPage({searchParams}:{searchParams:SearchParams}){
 const{view="all"}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
 if(profile?.role==="advisor")redirect("/admin/reports");
 const{data:reports}=await supabase.from("farmer_reports").select("id,field_id,title,message,status,created_at,advisor_reply,replied_at").eq("farmer_id",user.id).order("created_at",{ascending:false});
 const fieldIds=[...new Set((reports??[]).map(r=>r.field_id).filter(Boolean))] as string[];
 const{data:fields}=fieldIds.length?await supabase.from("fields").select("id,name").in("id",fieldIds):{data:[]};
 const all=reports??[];
 const waiting=all.filter(r=>r.status!=="reviewed"&&r.status!=="closed");
 const answered=all.filter(r=>r.status==="reviewed");
 const closed=all.filter(r=>r.status==="closed");
 const visible=all.filter(r=>view==="waiting"?r.status!=="reviewed"&&r.status!=="closed":view==="answered"?r.status==="reviewed":view==="closed"?r.status==="closed":true);
 return <div className="app-shell farmer-app"><Sidebar active="messages" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard">
  <header className="field-detail-header"><div><span className="eyebrow">KAPCSOLATTARTÁS</span><h1>Üzenetek</h1><p>A szaktanácsadónak küldött bejelentések és a rájuk érkezett szakmai válaszok.</p></div></header>
  <section className="stats-grid">
   <article className="stat-card"><span>Válaszra vár</span><strong>{waiting.length}</strong><small>Új bejelentés</small></article>
   <article className="stat-card"><span>Megválaszolva</span><strong>{answered.length}</strong><small>Aktív ügy</small></article>
   <article className="stat-card"><span>Lezárt</span><strong>{closed.length}</strong><small>Befejezett ügy</small></article>
   <article className="stat-card"><span>Összes</span><strong>{all.length}</strong><small>Teljes előzmény</small></article>
  </section>
  <section className="panel">
   <div className="panel-heading"><div><span className="eyebrow">BESZÉLGETÉSEK</span><h2>Korábbi bejelentések</h2></div><span className="user-pill">{visible.length} bejegyzés</span></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
    <Link className={view==="all"?"btn btn-primary":"ghost-btn"} href="/messages?view=all">Összes</Link>
    <Link className={view==="waiting"?"btn btn-primary":"ghost-btn"} href="/messages?view=waiting">Válaszra vár ({waiting.length})</Link>
    <Link className={view==="answered"?"btn btn-primary":"ghost-btn"} href="/messages?view=answered">Megválaszolva ({answered.length})</Link>
    <Link className={view==="closed"?"btn btn-primary":"ghost-btn"} href="/messages?view=closed">Lezárt ({closed.length})</Link>
   </div>
   {visible.length?visible.map(r=><article className="inspection-card" key={r.id}><div className="inspection-head"><div><strong>{r.title}</strong><small>{fields?.find(f=>f.id===r.field_id)?.name||"Földtábla"} · {new Date(r.created_at).toLocaleString("hu-HU")}</small></div><span className={`report-status ${r.status}`}>{statusLabel(r.status)}</span></div>{r.message&&<p>{r.message}</p>}{r.advisor_reply&&<div className="recommendation"><b>Szaktanácsadói válasz</b><span>{r.advisor_reply}</span>{r.replied_at&&<small>{new Date(r.replied_at).toLocaleString("hu-HU")}</small>}</div>}{r.field_id&&<Link className="back-link" href={`/fields/${r.field_id}`}>Földtábla megnyitása →</Link>}</article>):<div className="empty-state">Ebben a nézetben nincs üzenet.</div>}
  </section>
 </main></div>
}
