import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import "./timeline.css";

type SearchParams = Promise<{ type?: string }>;

type TimelineEvent = {
  id: string;
  farm_id: string | null;
  field_id: string | null;
  event_type: string | null;
  title: string;
  description: string | null;
  event_at: string | null;
  created_at: string;
};

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

function eventIcon(type: string | null) {
  if (type === "inspection") return "◉";
  if (type === "task_completed") return "✓";
  if (type === "task") return "!";
  if (type === "farmer_report") return "●";
  if (type === "advisor_reply") return "↩";
  if (type === "report_closed") return "✓";
  return "•";
}

function cleanTitle(title: string) {
  return title
    .replace("Táblaszemle: attention", "Táblaszemle: Figyelmet igényel")
    .replace("Táblaszemle: good", "Táblaszemle: Jó állapot")
    .replace("Táblaszemle: critical", "Táblaszemle: Kritikus");
}

function eventDate(event: TimelineEvent) {
  return event.event_at || event.created_at;
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string) {
  const date = new Date(value);
  const dateText = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    weekday: "long",
  }).format(date);
  return `${dateText} (${weekday})`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
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

  const timelineEvents = (events ?? []) as TimelineEvent[];
  const fieldIds = [...new Set(timelineEvents.map(event => event.field_id).filter(Boolean))] as string[];
  const farmIds = [...new Set(timelineEvents.map(event => event.farm_id).filter(Boolean))] as string[];
  const [{ data: fields }, { data: farms }] = await Promise.all([
    fieldIds.length ? supabase.from("fields").select("id,name").in("id", fieldIds) : Promise.resolve({ data: [] }),
    farmIds.length ? supabase.from("farms").select("id,name").in("id", farmIds) : Promise.resolve({ data: [] }),
  ]);

  const counts = {
    all: timelineEvents.length,
    inspection: timelineEvents.filter(e => eventGroup(e.event_type) === "inspection").length,
    task: timelineEvents.filter(e => eventGroup(e.event_type) === "task").length,
    communication: timelineEvents.filter(e => eventGroup(e.event_type) === "communication").length,
  };

  const visible = timelineEvents.filter(event => type === "all" || eventGroup(event.event_type) === type);
  const grouped = visible.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const key = dateKey(eventDate(event));
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

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

      <section className="stats-grid task-summary-grid timeline-stats">
        <article className="stat-card"><span>Összes esemény</span><strong>{counts.all}</strong><small>Legutóbbi 200 bejegyzés</small></article>
        <article className="stat-card"><span>Szemlék</span><strong>{counts.inspection}</strong><small>Helyszíni ellenőrzések</small></article>
        <article className="stat-card"><span>Teendők</span><strong>{counts.task}</strong><small>Kiadott és elvégzett</small></article>
        <article className="stat-card"><span>Kapcsolattartás</span><strong>{counts.communication}</strong><small>Bejelentések és válaszok</small></article>
      </section>

      <section className="panel timeline-page-panel">
        <div className="timeline-filter-tabs">
          <Link className={type === "all" ? "active" : ""} href="/timeline?type=all">Minden <span>{counts.all}</span></Link>
          <Link className={type === "inspection" ? "active" : ""} href="/timeline?type=inspection">Szemlék <span>{counts.inspection}</span></Link>
          <Link className={type === "task" ? "active" : ""} href="/timeline?type=task">Teendők <span>{counts.task}</span></Link>
          <Link className={type === "communication" ? "active" : ""} href="/timeline?type=communication">Kapcsolattartás <span>{counts.communication}</span></Link>
        </div>

        {visible.length ? Object.entries(grouped).map(([key, dayEvents]) => <section className="timeline-day-group" key={key}>
          <div className="timeline-day-heading"><span className="calendar-icon">▣</span><span>{formatDay(eventDate(dayEvents[0]))}</span></div>
          <div className="timeline-list global-timeline-clean">
            {dayEvents.map(event => {
              const field = fields?.find(item => item.id === event.field_id);
              const farm = farms?.find(item => item.id === event.farm_id);
              const date = eventDate(event);
              const group = eventGroup(event.event_type);
              return <article className="timeline-item" key={event.id}>
                <span className={`timeline-event-icon ${group}`}>{eventIcon(event.event_type)}</span>
                <div className="timeline-event-card">
                  <div className="timeline-event-top">
                    <span className={`timeline-type-pill ${group}`}>{eventTypeLabel(event.event_type)}</span>
                    <time>{formatTime(date)}</time>
                  </div>
                  <strong className="timeline-event-title">{cleanTitle(event.title)}</strong>
                  <small className="timeline-location">{field?.name || farm?.name || "Gazdasági esemény"}</small>
                  {event.description && <p>{event.description}</p>}
                  {event.field_id && <Link className="timeline-field-link" href={`/fields/${event.field_id}`}>Földtábla megnyitása →</Link>}
                </div>
              </article>;
            })}
          </div>
        </section>) : <div className="empty-state">Ebben a kategóriában még nincs esemény.</div>}
      </section>
    </main>
  </div>;
}
