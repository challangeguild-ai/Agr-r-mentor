import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

type SearchParams = Promise<{ type?: string }>;

function eventTypeLabel(type: string | null) {
  const labels: Record<string, string> = {
    inspection: "Szemle",
    task: "Teendő kiadva",
    task_completed: "Teendő elvégezve",
    farmer_report: "Gazdálkodói bejelentés",
    advisor_reply: "Szaktanácsadói válasz",
    report_closed: "Bejelentés lezárva",
  };
  return labels[type || ""] || "Naplóbejegyzés";
}

function eventGroup(type: string | null) {
  if (type === "inspection") return "inspection";
  if (type === "task" || type === "task_completed") return "task";
  if (type === "farmer_report" || type === "advisor_reply" || type === "report_closed") return "communication";
  return "other";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { type = "all" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data: events, error } = await supabase
    .from("timeline_events")
    .select("id,farm_id,field_id,event_type,title,description,event_at,created_at")
    .order("event_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const fieldIds = [...new Set((events ?? []).map(event => event.field_id).filter(Boolean))] as string[];
  const farmIds = [...new Set((events ?? []).map(event => event.farm_id).filter(Boolean))] as string[];
  const [{ data: fields }, { data: farms }] = await Promise.all([
    fieldIds.length ? supabase.from("fields").select("id,name").in("id", fieldIds) : Promise.resolve({ data: [] }),
    farmIds.length ? supabase.from("farms").select("id,name").in("id", farmIds) : Promise.resolve({ data: [] }),
  ]);

  const counts = {
    all: events?.length ?? 0,
    inspection: (events ?? []).filter(e => eventGroup(e.event_type) === "inspection").length,
    task: (events ?? []).filter(e => eventGroup(e.event_type) === "task").length,
    communication: (events ?? []).filter(e => eventGroup(e.event_type) === "communication").length,
  };

  const visible = (events ?? []).filter(event => type === "all" || eventGroup(event.event_type) === type);

  return <div className="app-shell">
    <Sidebar active="timeline" />
    <main className="dashboard">
      <header className="topbar">
        <div>
          <span className="eyebrow">GAZDASÁGI NAPLÓ</span>
          <h1>Idővonal</h1>
          <p>Minden fontos esemény időrendben, az összes elérhető földtábláról.</p>
        </div>
        <div className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</div>
      </header>

      <section className="stats-grid task-summary-grid">
        <article className="stat-card"><span>Összes esemény</span><strong>{counts.all}</strong><small>Legutóbbi 200 bejegyzés</small></article>
        <article className="stat-card"><span>Szemlék</span><strong>{counts.inspection}</strong><small>Helyszíni ellenőrzések</small></article>
        <article className="stat-card"><span>Teendők</span><strong>{counts.task}</strong><small>Kiadott és elvégzett</small></article>
        <article className="stat-card"><span>Kapcsolattartás</span><strong>{counts.communication}</strong><small>Bejelentések és válaszok</small></article>
      </section>

      <section className="panel">
        <div className="task-tabs">
          <Link className={type === "all" ? "active" : ""} href="/timeline?type=all">Minden <span>{counts.all}</span></Link>
          <Link className={type === "inspection" ? "active" : ""} href="/timeline?type=inspection">Szemlék <span>{counts.inspection}</span></Link>
          <Link className={type === "task" ? "active" : ""} href="/timeline?type=task">Teendők <span>{counts.task}</span></Link>
          <Link className={type === "communication" ? "active" : ""} href="/timeline?type=communication">Kapcsolattartás <span>{counts.communication}</span></Link>
        </div>

        {visible.length ? <div className="timeline-list global-timeline">{visible.map(event => {
          const field = fields?.find(item => item.id === event.field_id);
          const farm = farms?.find(item => item.id === event.farm_id);
          const date = event.event_at || event.created_at;
          return <div className="timeline-item" key={event.id}>
            <span className="timeline-dot"></span>
            <div className="timeline-content">
              <div className="timeline-meta">
                <span className="event-badge">{eventTypeLabel(event.event_type)}</span>
                <time>{formatDate(date)}</time>
              </div>
              <strong>{event.title}</strong>
              <small className="timeline-location">{field?.name || farm?.name || "Gazdasági esemény"}</small>
              {event.description && <p>{event.description}</p>}
              {event.field_id && <Link className="timeline-field-link" href={`/fields/${event.field_id}`}>Földtábla megnyitása →</Link>}
            </div>
          </div>;
        })}</div> : <div className="empty-state">Ebben a kategóriában még nincs esemény.</div>}
      </section>
    </main>
  </div>;
}
