import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFarm, createField, createTask, createInspection, inviteFarmer } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (me?.role !== "advisor") redirect("/dashboard");

  const [{ data: farmers }, { data: farms }, { data: fields }, { data: tasks }, { data: inspections }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("role", "farmer").order("full_name"),
    supabase.from("farms").select("id, name, settlement, owner_id").order("created_at", { ascending: false }),
    supabase.from("fields").select("id, name, area_ha, current_crop, farm_id").order("created_at", { ascending: false }).limit(50),
    supabase.from("tasks").select("id, title, due_date, priority, status, farm_id, field_id").order("created_at", { ascending: false }).limit(12),
    supabase.from("inspections").select("id, field_id, inspected_at, condition, recommendation").order("inspected_at", { ascending: false }).limit(8),
  ]);

  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI FELÜLET</span><h1>Ügyfelek és gazdaságok</h1><p>Gazdálkodók, gazdaságok, földtáblák, szemlék és kiadott teendők kezelése.</p></div><Link className="btn btn-secondary" href="/dashboard">Vissza a dashboardra</Link></header>
    <section className="admin-summary"><div><span>Gazdálkodók</span><strong>{farmers?.length ?? 0}</strong></div><div><span>Gazdaságok</span><strong>{farms?.length ?? 0}</strong></div><div><span>Táblák</span><strong>{fields?.length ?? 0}</strong></div></section>

    <section className="admin-grid">
      <article className="panel"><span className="eyebrow">ÚJ ÜGYFÉL</span><h2>Gazdálkodó meghívása</h2><form action={inviteFarmer} className="admin-form"><label>Gazdálkodó neve<input name="full_name" placeholder="pl. Kovács János" required /></label><label>E-mail cím<input name="email" type="email" placeholder="kovacs@example.hu" required /></label><button className="btn btn-primary" type="submit">Meghívó küldése</button></form><div className="notice" style={{marginTop:14}}>A meghívott felhasználó gazdálkodó szerepkört kap, és csak a saját gazdaságaihoz fér hozzá.</div></article>
      <article className="panel"><span className="eyebrow">ÜGYFELEK</span><h2>Gazdálkodók</h2>{farmers?.length ? <div className="client-list">{farmers.map(farmer => <div className="client-row" key={farmer.id}><div><strong>{farmer.full_name || "Névtelen ügyfél"}</strong><small>{farmer.phone || "Nincs telefonszám"}</small></div><span>{farms?.filter(farm => farm.owner_id === farmer.id).length ?? 0} gazdaság</span></div>)}</div> : <div className="notice">Még nincs gazdálkodói ügyfél.</div>}</article>
    </section>

    <section className="admin-grid">
      <article className="panel"><span className="eyebrow">ÚJ GAZDASÁG</span><h2>Gazdaság felvétele</h2>{farmers?.length ? <form action={createFarm} className="admin-form"><label>Gazdálkodó<select name="owner_id" required><option value="">Válassz ügyfelet</option>{farmers.map(f => <option key={f.id} value={f.id}>{f.full_name || "Névtelen ügyfél"}</option>)}</select></label><label>Gazdaság neve<input name="name" required /></label><label>Település<input name="settlement" /></label><label>Cím<input name="address" /></label><button className="btn btn-primary">Gazdaság létrehozása</button></form> : <div className="notice">Előbb szükség van legalább egy gazdálkodóra.</div>}</article>
      <article className="panel"><span className="eyebrow">FÖLDTÁBLA</span><h2>Új földtábla</h2>{farms?.length ? <form action={createField} className="admin-form"><label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}{f.settlement ? ` – ${f.settlement}` : ""}</option>)}</select></label><label>Tábla neve<input name="name" required /></label><label>Terület (ha)<input name="area_ha" inputMode="decimal" /></label><label>Kultúra<input name="current_crop" /></label><button className="btn btn-primary">Tábla létrehozása</button></form> : <div className="notice">Először hozz létre legalább egy gazdaságot.</div>}</article>
    </section>

    <section className="panel admin-field-panel"><span className="eyebrow">TÁBLASZEMLE</span><h2>Új szemle rögzítése</h2>{fields?.length ? <form action={createInspection} className="admin-form inspection-create-grid">
      <label>Földtábla<select name="field_id" required><option value="">Válassz táblát</option>{fields.map(field => { const farm=farms?.find(f=>f.id===field.farm_id); return <option key={field.id} value={field.id}>{field.name} – {farm?.name || "Gazdaság"}</option>; })}</select></label>
      <label>Szemle dátuma<input name="inspected_at" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></label>
      <label>Állapot / minősítés<input name="condition" placeholder="pl. Jó állapot, gyomosodás észlelhető" required /></label>
      <label className="inspection-wide">Megfigyelés<textarea name="notes" rows={3} placeholder="Mit tapasztaltál a helyszínen?" /></label>
      <label className="inspection-wide">Szaktanácsadói javaslat<textarea name="recommendation" rows={3} placeholder="Javasolt kezelés, következő lépés, kontroll időpontja..." /></label>
      <button className="btn btn-primary" type="submit">Szemle mentése</button>
    </form> : <div className="notice">Szemléhez előbb szükség van földtáblára.</div>}</section>

    <section className="panel admin-field-panel"><span className="eyebrow">TEENDŐ KIADÁSA</span><h2>Új feladat a gazdálkodónak</h2>{farms?.length ? <form action={createTask} className="admin-form task-create-grid"><label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Földtábla<select name="field_id"><option value="">Teljes gazdaság / nincs tábla</option>{fields?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Feladat<input name="title" required /></label><label>Határidő<input name="due_date" type="date" /></label><label>Prioritás<select name="priority" defaultValue="normal"><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select></label><label className="task-description">Megjegyzés<input name="description" /></label><button className="btn btn-primary">Teendő kiadása</button></form> : <div className="notice">Teendő kiadásához előbb hozz létre gazdaságot.</div>}</section>

    <section className="admin-grid">
      <article className="panel admin-list"><div className="panel-heading"><div><span className="eyebrow">LEGUTÓBBI SZEMLÉK</span><h2>Szemlenapló</h2></div></div>{inspections?.length ? inspections.map(item => { const field=fields?.find(f=>f.id===item.field_id); return <div className="admin-row" key={item.id}><div><strong>{item.condition || "Táblaszemle"}</strong><small>{field?.name || "Földtábla"}</small></div><span>{new Date(item.inspected_at).toLocaleDateString("hu-HU")}</span><Link href={`/fields/${item.field_id}`}><b>Megnyitás →</b></Link></div>; }) : <div className="empty-state">Még nincs rögzített szemle.</div>}</article>
      <article className="panel admin-list"><div className="panel-heading"><div><span className="eyebrow">KIADOTT FELADATOK</span><h2>Legutóbbi teendők</h2></div></div>{tasks?.length ? tasks.map(task => { const farm=farms?.find(f=>f.id===task.farm_id); const field=fields?.find(f=>f.id===task.field_id); return <div className="task-admin-row" key={task.id}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{farm?.name || "Gazdaság"}{field ? ` · ${field.name}` : ""}</small></div><div><b>{task.due_date ? new Date(task.due_date).toLocaleDateString("hu-HU") : "Nincs határidő"}</b><small>{task.status === "done" ? "Kész" : "Nyitott"}</small></div></div>; }) : <div className="empty-state">Még nincs kiadott teendő.</div>}</article>
    </section>
  </main>;
}
