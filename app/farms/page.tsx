import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function FarmsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
  if(profile?.role==="advisor") redirect("/admin/clients");
  const { data: farms, error } = await supabase.from("farms").select("id,name,settlement,address,owner_id,created_at").eq("owner_id",user.id).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const farmIds = (farms ?? []).map(farm => farm.id);
  const { data: fields } = farmIds.length
    ? await supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,crop_year,status").in("farm_id", farmIds).order("created_at", { ascending: true })
    : { data: [] };
  const { data: tasks } = farmIds.length
    ? await supabase.from("tasks").select("id,farm_id,status").in("farm_id", farmIds).eq("assigned_to",user.id)
    : { data: [] };

  const totalArea = (fields ?? []).reduce((sum, field) => sum + (Number(field.area_ha) || 0), 0);
  const openTasks = (tasks ?? []).filter(task => task.status !== "done").length;

  return <div className="app-shell farmer-app">
    <Sidebar active="farms" userName={profile?.full_name||"Gazdálkodó"}/>
    <main className="dashboard">
      <header className="topbar">
        <div><span className="eyebrow">GAZDASÁGI ÁTTEKINTÉS</span><h1>Gazdaságom</h1><p>A gazdaságok és a hozzájuk tartozó földterületek összefoglalója.</p></div>
      </header>

      <section className="stats-grid">
        <article className="stat-card"><span>Gazdaságok</span><strong>{farms?.length ?? 0}</strong><small>Nyilvántartott gazdaság</small></article>
        <article className="stat-card"><span>Földtáblák</span><strong>{fields?.length ?? 0}</strong><small>Összes földtábla</small></article>
        <article className="stat-card"><span>Összterület</span><strong>{totalArea.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} ha</strong><small>Nyilvántartott terület</small></article>
        <article className="stat-card"><span>Nyitott teendők</span><strong>{openTasks}</strong><small>Elvégzésre vár</small></article>
      </section>

      <section className="dashboard-grid lower">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">GAZDASÁGOK</span><h2>Gazdasági adatok</h2></div></div>
          {farms?.length ? <div className="inspection-list">{farms.map(farm => {
            const farmFields = (fields ?? []).filter(field => field.farm_id === farm.id);
            const area = farmFields.reduce((sum, field) => sum + (Number(field.area_ha) || 0), 0);
            return <article className="inspection-card" key={farm.id}>
              <div className="inspection-head"><div><strong>{farm.name}</strong><small>{farm.settlement || "Település nincs megadva"}</small></div><span className="field-total">{farmFields.length} tábla</span></div>
              {farm.address && <p>{farm.address}</p>}
              <div className="field-meta"><span><b>{area.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} ha</b><small>Terület</small></span><span><b>{farmFields.length}</b><small>Táblák</small></span><span><b>{(tasks ?? []).filter(task => task.farm_id === farm.id && task.status !== "done").length}</b><small>Nyitott teendő</small></span></div>
            </article>;
          })}</div> : <div className="empty-state">Még nincs gazdaság rögzítve.</div>}
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">GYORS ELÉRÉS</span><h2>Földtáblák</h2></div><Link className="ghost-btn" href="/fields">Összes tábla</Link></div>
          {fields?.length ? <div className="field-overview-grid">{fields.slice(0, 6).map(field => <Link className="field-card field-card-link" href={`/fields/${field.id}`} key={field.id}>
            <div className="field-card-top"><span className="field-icon">{field.name.slice(0,1).toUpperCase()}</span><div><strong>{field.name}</strong><small>{field.current_crop || "Nincs kultúra megadva"}</small></div><span className="field-arrow">→</span></div>
            <div className="field-meta"><span><b>{field.area_ha ? `${field.area_ha} ha` : "—"}</b><small>Terület</small></span><span><b>{field.crop_year || new Date().getFullYear()}</b><small>Év</small></span></div>
          </Link>)}</div> : <div className="empty-state">Még nincs földtábla rögzítve.</div>}
        </article>
      </section>
    </main>
  </div>;
}
