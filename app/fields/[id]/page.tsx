import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("hu-HU");
}

export default async function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: field }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("fields").select("id, farm_id, name, area_ha, current_crop, crop_year, sowing_date, status, notes").eq("id", id).maybeSingle(),
  ]);

  if (!field) notFound();

  const [{ data: farm }, { data: tasks }, { data: inspections }, { data: timeline }] = await Promise.all([
    supabase.from("farms").select("name, settlement, address").eq("id", field.farm_id).maybeSingle(),
    supabase.from("tasks").select("id, title, description, due_date, priority, status, created_at").eq("field_id", id).order("created_at", { ascending: false }),
    supabase.from("inspections").select("id, inspected_at, condition, notes, recommendation, created_at").eq("field_id", id).order("inspected_at", { ascending: false }),
    supabase.from("timeline_events").select("id, event_type, title, description, event_at, created_at").eq("field_id", id).order("event_at", { ascending: false }),
  ]);

  const generatedEvents = [
    ...(inspections ?? []).map((item) => ({ id: `inspection-${item.id}`, type: "Szemle", title: item.condition || "Táblaszemle", description: item.recommendation || item.notes || "Szemle rögzítve.", date: item.inspected_at || item.created_at })),
    ...(tasks ?? []).map((item) => ({ id: `task-${item.id}`, type: "Teendő", title: item.title, description: item.description || (item.status === "done" ? "Feladat lezárva." : "Kiadott feladat."), date: item.created_at })),
    ...(timeline ?? []).map((item) => ({ id: `timeline-${item.id}`, type: item.event_type || "Napló", title: item.title, description: item.description || "", date: item.event_at || item.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="dashboard">
        <header className="field-detail-header">
          <div>
            <Link href="/dashboard" className="back-link">← Vissza az áttekintéshez</Link>
            <span className="eyebrow">FÖLDTÁBLA ADATLAP</span>
            <h1>{field.name}</h1>
            <p>{farm?.name || "Gazdaság"}{farm?.settlement ? ` · ${farm.settlement}` : ""}</p>
          </div>
          <div className="topbar-actions">
            {profile?.role === "advisor" && <Link className="btn btn-primary" href="/admin">Szaktanácsadói admin</Link>}
            <span className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</span>
          </div>
        </header>

        <section className="field-detail-stats">
          <article className="stat-card"><span>Terület</span><strong>{field.area_ha ? `${field.area_ha} ha` : "—"}</strong><small>Nyilvántartott terület</small></article>
          <article className="stat-card"><span>Aktuális kultúra</span><strong className="field-stat-text">{field.current_crop || "—"}</strong><small>{field.crop_year || new Date().getFullYear()}. gazdasági év</small></article>
          <article className="stat-card"><span>Vetés</span><strong className="field-stat-text">{formatDate(field.sowing_date)}</strong><small>Vetési dátum</small></article>
          <article className="stat-card"><span>Nyitott teendők</span><strong>{(tasks ?? []).filter((task) => task.status !== "done").length}</strong><small>Ehhez a táblához</small></article>
        </section>

        <section className="field-detail-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">SZAKTANÁCSADÁS</span><h2>Szemlék és javaslatok</h2></div><span className="field-total">{inspections?.length ?? 0} szemle</span></div>
            {inspections?.length ? <div className="inspection-list">{inspections.map((inspection) => <div className="inspection-card" key={inspection.id}><div className="inspection-head"><div><strong>{inspection.condition || "Táblaszemle"}</strong><small>{formatDate(inspection.inspected_at)}</small></div><span className="event-badge">Szemle</span></div>{inspection.notes && <p>{inspection.notes}</p>}{inspection.recommendation && <div className="recommendation"><b>Szaktanácsadói javaslat</b><span>{inspection.recommendation}</span></div>}</div>)}</div> : <div className="empty-state">Ehhez a táblához még nincs rögzített szemle.</div>}
          </article>

          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">FELADATOK</span><h2>Teendők</h2></div></div>
            {tasks?.length ? <div className="task-list">{tasks.map((task) => <div className="task-row" key={task.id}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{task.due_date ? `Határidő: ${formatDate(task.due_date)}` : "Nincs határidő"}{task.description ? ` · ${task.description}` : ""}</small></div><span className="task-status">{task.status === "done" ? "Kész" : "Nyitott"}</span></div>)}</div> : <div className="empty-state">Nincs ehhez a táblához kiadott teendő.</div>}
          </article>
        </section>

        <section className="panel field-timeline-panel">
          <div className="panel-heading"><div><span className="eyebrow">NAPLÓ</span><h2>Tábla idővonala</h2></div></div>
          {generatedEvents.length ? <div className="timeline-list">{generatedEvents.map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot"></span><div className="timeline-content"><div className="timeline-meta"><span className="event-badge">{event.type}</span><time>{formatDate(event.date)}</time></div><strong>{event.title}</strong>{event.description && <p>{event.description}</p>}</div></div>)}</div> : <div className="empty-state">A tábla idővonala még üres.</div>}
        </section>
      </main>
    </div>
  );
}
