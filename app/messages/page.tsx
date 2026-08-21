import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";

function statusLabel(v:string){if(v==="reviewed")return"Megválaszolva";if(v==="closed")return"Lezárva";return"Új"}

export default async function MessagesPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
  if(profile?.role==="advisor")redirect("/admin/reports");
  const[{data:reports},{data:fields}]=await Promise.all([
    supabase.from("farmer_reports").select("id,field_id,title,message,status,created_at,advisor_reply,replied_at").order("created_at",{ascending:false}),
    supabase.from("fields").select("id,name").order("name")
  ]);
  return <div className="app-shell farmer-app"><Sidebar active="messages" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><header className="field-detail-header"><div><span className="eyebrow">KAPCSOLATTARTÁS</span><h1>Üzenetek</h1><p>A szaktanácsadónak küldött bejelentések és a rájuk érkezett szakmai válaszok.</p></div></header><section className="panel"><div className="panel-heading"><div><span className="eyebrow">BESZÉLGETÉSEK</span><h2>Korábbi bejelentések</h2></div><span className="user-pill">{reports?.length??0} bejegyzés</span></div>{reports?.length?reports.map(r=><article className="inspection-card" key={r.id}><div className="inspection-head"><div><strong>{r.title}</strong><small>{fields?.find(f=>f.id===r.field_id)?.name||"Földtábla"} · {new Date(r.created_at).toLocaleString("hu-HU")}</small></div><span className={`report-status ${r.status}`}>{statusLabel(r.status)}</span></div>{r.message&&<p>{r.message}</p>}{r.advisor_reply&&<div className="recommendation"><b>Szaktanácsadói válasz</b><span>{r.advisor_reply}</span></div>}{r.field_id&&<Link className="back-link" href={`/fields/${r.field_id}`}>Földtábla megnyitása →</Link>}</article>):<div className="empty-state">Még nincs bejelentés vagy üzenet.</div>}</section></main></div>
}
