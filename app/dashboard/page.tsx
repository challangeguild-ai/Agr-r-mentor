import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: farms }, { data: tasks }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("farms").select("id, name, settlement").order("created_at", { ascending: true }),
    supabase.from("tasks").select("id, title, due_date, priority, status").neq("status", "done").order("due_date", { ascending: true }).limit(5),
  ]);

  const farmIds = farms?.map((farm) => farm.id) ?? [];
  const { data: fields } = farmIds.length
    ? await supabase.from("fields").select("id, name, area_ha, current_crop, crop_year, farm_id").in("farm_id", farmIds).order("created_at", { ascending: true })
    : { data: [] };

  const name = profile?.full_name || "Gazdálkodó";
  const totalArea = (fields ?? []).reduce((sum, field) => sum + (Number(field.area_ha) || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="dashboard">
        <header className="topbar">
          <div><span className="eyebrow">ÜGYFÉLPORTÁL</span><h1>Üdvözöljük, {name}!</h1><p>Itt látja a gazdasága aktuális állapotát és következő teendőit.</p></div>
          <div className="topbar-actions">{profile?.role === "advisor" && <Link className="btn btn-primary" href="/admin">Szaktanácsadói admin</Link>}<div className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</div></div>
        </header>

        <section className="stats-grid">
          <article className="stat-card"><span>Gazdaságok</span><strong>{farms?.length ?? 0}</strong><small>Aktív gazdaságok</small></article>
          <article className="stat-card"><span>Táblák</span><strong>{fields?.length ?? 0}</strong><small>{totalArea ? `${totalArea.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} ha összesen` : "Nincs megadott terület"}</small></article>
          <article className="stat-card"><span>Nyitott teendők</span><strong>{tasks?.length ?? 0}</strong><small>Határidő szerint</small></article>
          <article className="stat-card"><span>Állapot</span><strong className="ok">Rendben</strong><small>A rendszer elérhető</small></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel map-panel">
            <div className="panel-heading"><div><span className="eyebrow">FÖLDTERÜLETEK</span><h2>Saját táblák</h2></div><span className="field-total">{fields?.length ?? 0} tábla</span></div>
            {fields?.length ? <div className="field-overview-grid">{fields.map((field) => {
              const farm = farms?.find((item) => item.id === field.farm_id);
              return <Link className="field-card field-card-link" href={`/fields/${field.id}`} key={field.id}>
                <div className="field-card-top"><span className="field-icon">{field.name.slice(0, 1).toUpperCase()}</span><div><strong>{field.name}</strong><small>{farm?.name || "Gazdaság"}{farm?.settlement ? ` · ${farm.settlement}` : ""}</small></div><span className="field-arrow">→</span></div>
                <div className="field-meta"><span><b>{field.area_ha ? `${field.area_ha} ha` : "—"}</b><small>Terület</small></span><span><b>{field.current_crop || "—"}</b><small>Kultúra</small></span><span><b>{field.crop_year || new Date().getFullYear()}</b><small>Év</small></span></div>
              </Link>;
            })}</div> : <div className="empty-state">Ehhez a gazdálkodóhoz még nincs földtábla rögzítve.</div>}
          </article>

          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">KÖVETKEZŐ</span><h2>Teendők</h2></div></div>
            <div className="task-list">{(tasks?.length ? tasks : [{ id: "demo", title: "Még nincs kiadott teendő", due_date: null, priority: "normal", status: "open" }]).map((task) => <div className="task-row" key={task.id}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{task.due_date ? new Date(task.due_date).toLocaleDateString("hu-HU") : "Nincs határidő"}</small></div><span className="task-status">Nyitott</span></div>)}</div>
          </article>
        </section>
      </main>
    </div>
  );
}
