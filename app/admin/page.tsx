import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFarm, createField, createTask, inviteFarmer } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (me?.role !== "advisor") redirect("/dashboard");

  const [{ data: farmers }, { data: farms }, { data: fields }, { data: tasks }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("role", "farmer").order("full_name"),
    supabase.from("farms").select("id, name, settlement, owner_id").order("created_at", { ascending: false }),
    supabase.from("fields").select("id, name, area_ha, current_crop, farm_id").order("created_at", { ascending: false }).limit(50),
    supabase.from("tasks").select("id, title, due_date, priority, status, farm_id, field_id").order("created_at", { ascending: false }).limit(12),
  ]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="eyebrow">SZAKTANÁCSADÓI FELÜLET</span><h1>Ügyfelek és gazdaságok</h1><p>Gazdálkodók, gazdaságok, földtáblák és kiadott teendők kezelése.</p></div>
        <Link className="btn btn-secondary" href="/dashboard">Vissza a dashboardra</Link>
      </header>

      <section className="admin-summary">
        <div><span>Gazdálkodók</span><strong>{farmers?.length ?? 0}</strong></div>
        <div><span>Gazdaságok</span><strong>{farms?.length ?? 0}</strong></div>
        <div><span>Táblák</span><strong>{fields?.length ?? 0}</strong></div>
      </section>

      <section className="admin-grid">
        <article className="panel"><span className="eyebrow">ÚJ ÜGYFÉL</span><h2>Gazdálkodó meghívása</h2>
          <form action={inviteFarmer} className="admin-form"><label>Gazdálkodó neve<input name="full_name" placeholder="pl. Kovács János" required /></label><label>E-mail cím<input name="email" type="email" placeholder="kovacs@example.hu" required /></label><button className="btn btn-primary" type="submit">Meghívó küldése</button></form>
          <div className="notice" style={{marginTop:14}}>A meghívott felhasználó gazdálkodó szerepkört kap, és csak a saját gazdaságaihoz fér hozzá.</div>
        </article>
        <article className="panel"><span className="eyebrow">ÜGYFELEK</span><h2>Gazdálkodók</h2>
          {farmers?.length ? <div className="client-list">{farmers.map((farmer) => <div className="client-row" key={farmer.id}><div><strong>{farmer.full_name || "Névtelen ügyfél"}</strong><small>{farmer.phone || "Nincs telefonszám"}</small></div><span>{farms?.filter((farm) => farm.owner_id === farmer.id).length ?? 0} gazdaság</span></div>)}</div> : <div className="notice">Még nincs gazdálkodói ügyfél.</div>}
        </article>
      </section>

      <section className="admin-grid">
        <article className="panel"><span className="eyebrow">ÚJ GAZDASÁG</span><h2>Gazdaság felvétele</h2>
          {farmers?.length ? <form action={createFarm} className="admin-form"><label>Gazdálkodó<select name="owner_id" required><option value="">Válassz ügyfelet</option>{farmers.map((farmer) => <option key={farmer.id} value={farmer.id}>{farmer.full_name || "Névtelen ügyfél"}</option>)}</select></label><label>Gazdaság neve<input name="name" placeholder="pl. Kovács Családi Gazdaság" required /></label><label>Település<input name="settlement" placeholder="pl. Nagykáta" /></label><label>Cím<input name="address" placeholder="Opcionális" /></label><button className="btn btn-primary" type="submit">Gazdaság létrehozása</button></form> : <div className="notice">Előbb szükség van legalább egy gazdálkodóra.</div>}
        </article>
        <article className="panel"><span className="eyebrow">FÖLDTÁBLA</span><h2>Új földtábla</h2>
          {farms?.length ? <form action={createField} className="admin-form"><label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}{farm.settlement ? ` – ${farm.settlement}` : ""}</option>)}</select></label><label>Tábla neve<input name="name" placeholder="pl. Nagyrét 03" required /></label><label>Terület (ha)<input name="area_ha" inputMode="decimal" placeholder="12,46" /></label><label>Kultúra<input name="current_crop" placeholder="pl. Őszi búza" /></label><button className="btn btn-primary" type="submit">Tábla létrehozása</button></form> : <div className="notice">Először hozz létre legalább egy gazdaságot.</div>}
        </article>
      </section>

      <section className="panel admin-field-panel">
        <span className="eyebrow">TEENDŐ KIADÁSA</span><h2>Új feladat a gazdálkodónak</h2>
        {farms?.length ? <form action={createTask} className="admin-form task-create-grid">
          <label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
          <label>Földtábla<select name="field_id"><option value="">Teljes gazdaság / nincs tábla</option>{fields?.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
          <label>Feladat<input name="title" placeholder="pl. Állományellenőrzés" required /></label>
          <label>Határidő<input name="due_date" type="date" /></label>
          <label>Prioritás<select name="priority" defaultValue="normal"><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select></label>
          <label className="task-description">Megjegyzés<input name="description" placeholder="Rövid szakmai instrukció" /></label>
          <button className="btn btn-primary" type="submit">Teendő kiadása</button>
        </form> : <div className="notice">Teendő kiadásához előbb hozz létre gazdaságot.</div>}
      </section>

      <section className="admin-grid">
        <article className="panel admin-list"><div className="panel-heading"><div><span className="eyebrow">NYILVÁNTARTÁS</span><h2>Legutóbbi földtáblák</h2></div></div>
          {fields?.length ? fields.slice(0,12).map((field) => { const farm = farms?.find((item) => item.id === field.farm_id); return <div className="admin-row" key={field.id}><div><strong>{field.name}</strong><small>{farm?.name || "Ismeretlen gazdaság"}</small></div><span>{field.current_crop || "Nincs kultúra"}</span><b>{field.area_ha ? `${field.area_ha} ha` : "—"}</b></div>; }) : <div className="empty-state">Még nincs felvett földtábla.</div>}
        </article>
        <article className="panel admin-list"><div className="panel-heading"><div><span className="eyebrow">KIADOTT FELADATOK</span><h2>Legutóbbi teendők</h2></div></div>
          {tasks?.length ? tasks.map((task) => { const farm = farms?.find((item) => item.id === task.farm_id); const field = fields?.find((item) => item.id === task.field_id); return <div className="task-admin-row" key={task.id}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{farm?.name || "Gazdaság"}{field ? ` · ${field.name}` : ""}</small></div><div><b>{task.due_date ? new Date(task.due_date).toLocaleDateString("hu-HU") : "Nincs határidő"}</b><small>{task.status === "done" ? "Kész" : "Nyitott"}</small></div></div>; }) : <div className="empty-state">Még nincs kiadott teendő.</div>}
        </article>
      </section>
    </main>
  );
}
