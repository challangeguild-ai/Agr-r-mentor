import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

function statusLabel(status: string | null) {
  if (status === "inactive") return "Inaktív";
  if (status === "archived") return "Archivált";
  return "Aktív";
}

type SearchParams = Promise<{ view?: string }>;

export default async function FieldsPage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "all" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: fields, error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,crop_year,sowing_date,status,created_at").order("name"),
  ]);
  if (error) throw new Error(error.message);

  const farmIds = [...new Set((fields ?? []).map(field => field.farm_id).filter(Boolean))] as string[];
  const { data: farms } = farmIds.length
    ? await supabase.from("farms").select("id,name,settlement").in("id", farmIds)
    : { data: [] };
  const { data: tasks } = fields?.length
    ? await supabase.from("tasks").select("id,field_id,status,due_date,priority").in("field_id", (fields ?? []).map(field => field.id))
    : { data: [] };

  const totalArea = (fields ?? []).reduce((sum, field) => sum + (Number(field.area_ha) || 0), 0);
  const active = (fields ?? []).filter(field => field.status !== "inactive" && field.status !== "archived").length;
  const openTasks = (tasks ?? []).filter(task => task.status !== "done").length;
  const attentionIds = new Set((tasks ?? []).filter(task => task.status !== "done" && (task.priority === "urgent" || task.priority === "high")).map(task => task.field_id));
  const noTaskIds = new Set((fields ?? []).filter(field => !(tasks ?? []).some(task => task.field_id === field.id && task.status !== "done")).map(field => field.id));
  const visibleFields = (fields ?? []).filter(field => {
    if (view === "active") return field.status !== "inactive" && field.status !== "archived";
    if (view === "attention") return attentionIds.has(field.id);
    if (view === "no-tasks") return noTaskIds.has(field.id);
    if (view === "archived") return field.status === "archived" || field.status === "inactive";
    return true;
  });
  const tabs = [
    ["all", "Összes", fields?.length ?? 0],
    ["active", "Aktív", active],
    ["attention", "Figyelmet igényel", attentionIds.size],
    ["no-tasks", "Nincs nyitott teendő", noTaskIds.size],
    ["archived", "Inaktív / archivált", (fields ?? []).length - active],
  ] as const;

  return <div className="app-shell">
    <Sidebar active="fields" />
    <main className="dashboard">
      <header className="topbar">
        <div><span className="eyebrow">FÖLDTERÜLETEK</span><h1>Táblák</h1><p>Minden földtábla egy helyen, kultúrával, területtel és aktuális feladatokkal.</p></div>
        <div className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</div>
      </header>

      <section className="stats-grid">
        <article className="stat-card"><span>Összes tábla</span><strong>{fields?.length ?? 0}</strong><small>Nyilvántartott földtábla</small></article>
        <article className="stat-card"><span>Aktív</span><strong>{active}</strong><small>Aktív művelésben</small></article>
        <article className="stat-card"><span>Összterület</span><strong>{totalArea.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} ha</strong><small>Teljes terület</small></article>
        <article className="stat-card"><span>Nyitott teendők</span><strong>{openTasks}</strong><small>Táblákhoz rendelve</small></article>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">FÖLDTÁBLÁK</span><h2>Táblajegyzék</h2></div><span className="field-total">{visibleFields.length} tábla</span></div>
        <div className="task-filter-tabs">{tabs.map(([key,label,count]) => <Link key={key} className={view === key ? "active" : ""} href={`/fields?view=${key}`}>{label} <b>{count}</b></Link>)}</div>
        {visibleFields.length ? <div className="field-overview-grid">{visibleFields.map(field => {
          const farm = farms?.find(item => item.id === field.farm_id);
          const fieldTasks = (tasks ?? []).filter(task => task.field_id === field.id && task.status !== "done");
          const importantTasks = fieldTasks.filter(task => task.priority === "urgent" || task.priority === "high").length;
          return <Link className="field-card field-card-link" href={`/fields/${field.id}`} key={field.id}>
            <div className="field-card-top"><span className="field-icon">{field.name.slice(0,1).toUpperCase()}</span><div><strong>{field.name}</strong><small>{farm?.name || "Gazdaság"}{farm?.settlement ? ` · ${farm.settlement}` : ""}</small></div><span className="field-arrow">→</span></div>
            <div className="field-meta"><span><b>{field.area_ha ? `${field.area_ha} ha` : "—"}</b><small>Terület</small></span><span><b>{field.current_crop || "—"}</b><small>Kultúra</small></span><span><b>{field.crop_year || new Date().getFullYear()}</b><small>Év</small></span></div>
            <div className="field-meta"><span><b>{statusLabel(field.status)}</b><small>Állapot</small></span><span><b>{fieldTasks.length}{importantTasks ? ` (${importantTasks} fontos)` : ""}</b><small>Nyitott teendő</small></span><span><b>{field.sowing_date ? new Date(`${field.sowing_date}T12:00:00`).toLocaleDateString("hu-HU") : "—"}</b><small>Vetés</small></span></div>
          </Link>;
        })}</div> : <div className="empty-state">Ebben a nézetben nincs földtábla.</div>}
      </section>
    </main>
  </div>;
}
