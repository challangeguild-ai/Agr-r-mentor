import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {NotificationBell} from "@/components/NotificationBell";
import {AdminNav} from "@/components/AdminNav";

export default async function AdminPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor")redirect("/dashboard");

  const[{count:farmers},{count:farms},{count:fields},{count:openReports},{count:openTasks},{count:inspections},{data:recentReports},{data:recentTasks}]=await Promise.all([
    supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","farmer"),
    supabase.from("farms").select("id",{count:"exact",head:true}),
    supabase.from("fields").select("id",{count:"exact",head:true}),
    supabase.from("farmer_reports").select("id",{count:"exact",head:true}).neq("status","closed"),
    supabase.from("tasks").select("id",{count:"exact",head:true}).neq("status","done"),
    supabase.from("inspections").select("id",{count:"exact",head:true}),
    supabase.from("farmer_reports").select("id,title,status,created_at,field_id").order("created_at",{ascending:false}).limit(5),
    supabase.from("tasks").select("id,title,status,due_date,field_id").order("created_at",{ascending:false}).limit(5),
  ]);

  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI VEZÉRLŐPULT</span><h1>Áttekintés</h1><p>Az ügyfelek, bejelentések, szemlék és teendők gyors állapota egy helyen.</p></div><div className="topbar-actions"><NotificationBell/><Link className="btn btn-secondary" href="/dashboard">Gazdálkodói nézet</Link></div></header>
    <AdminNav active="overview"/>

    <section className="admin-overview-grid">
      <Link href="/admin/clients" className="admin-overview-card"><span>Ügyfelek</span><strong>{farmers??0}</strong><small>{farms??0} gazdaság · {fields??0} tábla</small></Link>
      <Link href="/admin/reports" className="admin-overview-card"><span>Nyitott bejelentések</span><strong>{openReports??0}</strong><small>Gazdálkodói jelzések</small></Link>
      <Link href="/admin/inspections" className="admin-overview-card"><span>Rögzített szemlék</span><strong>{inspections??0}</strong><small>Szemlenapló</small></Link>
      <Link href="/admin/tasks" className="admin-overview-card"><span>Nyitott teendők</span><strong>{openTasks??0}</strong><small>Kiadott feladatok</small></Link>
    </section>

    <section className="admin-grid">
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">LEGUTÓBBI</span><h2>Bejelentések</h2></div><Link className="ghost-btn" href="/admin/reports">Összes →</Link></div>{recentReports?.length?recentReports.map(r=><div className="admin-row compact" key={r.id}><div><strong>{r.title}</strong><small>{new Date(r.created_at).toLocaleString("hu-HU")}</small></div><span>{r.status==="closed"?"Lezárva":r.status==="reviewed"?"Megválaszolva":"Új"}</span>{r.field_id&&<Link href={`/fields/${r.field_id}`}>Megnyitás →</Link>}</div>):<div className="empty-state">Nincs bejelentés.</div>}</article>
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">LEGUTÓBBI</span><h2>Teendők</h2></div><Link className="ghost-btn" href="/admin/tasks">Összes →</Link></div>{recentTasks?.length?recentTasks.map(t=><div className="admin-row compact" key={t.id}><div><strong>{t.title}</strong><small>{t.due_date?`Határidő: ${new Date(t.due_date).toLocaleDateString("hu-HU")}`:"Nincs határidő"}</small></div><span>{t.status==="done"?"Kész":"Nyitott"}</span>{t.field_id&&<Link href={`/fields/${t.field_id}`}>Megnyitás →</Link>}</div>):<div className="empty-state">Nincs teendő.</div>}</article>
    </section>
  </main>
}
