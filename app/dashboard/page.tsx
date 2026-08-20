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

  const name = profile?.full_name || "Gazdálkodó";

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="dashboard">
        <header className="topbar">
          <div><span className="eyebrow">ÜGYFÉLPORTÁL</span><h1>Üdvözöljük, {name}!</h1><p>Itt látja a gazdasága aktuális állapotát és következő teendőit.</p></div>
          <div className="topbar-actions">
            {profile?.role === "advisor" && <Link className="btn btn-primary" href="/admin">Szaktanácsadói admin</Link>}
            <div className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</div>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card"><span>Gazdaságok</span><strong>{farms?.length ?? 0}</strong><small>Aktív gazdaságok</small></article>
          <article className="stat-card"><span>Táblák</span><strong>—</strong><small>Következő fejlesztési lépés</small></article>
          <article className="stat-card"><span>Nyitott teendők</span><strong>{tasks?.length ?? 0}</strong><small>Határidő szerint</small></article>
          <article className="stat-card"><span>Állapot</span><strong className="ok">Rendben</strong><small>A rendszer elérhető</small></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel map-panel">
            <div className="panel-heading"><div><span className="eyebrow">TÉRKÉP</span><h2>Saját földterületek</h2></div></div>
            <div className="map-placeholder"><div className="field-shape one">1</div><div className="field-shape two">2</div><div className="field-shape three">3</div><p>Itt jelenik majd meg a valódi térkép és a PostGIS-ben tárolt táblahatár.</p></div>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">KÖVETKEZŐ</span><h2>Teendők</h2></div></div>
            <div className="task-list">
              {(tasks?.length ? tasks : [{ id: "demo", title: "Első gazdaság felvétele", due_date: null, priority: "normal", status: "open" }]).map((task) => (
                <div className="task-row" key={task.id}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{task.due_date ? new Date(task.due_date).toLocaleDateString("hu-HU") : "Nincs határidő"}</small></div><span className="task-status">Nyitott</span></div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
