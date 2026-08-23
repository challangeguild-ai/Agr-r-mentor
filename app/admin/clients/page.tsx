import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {inviteFarmer,createFarm,createField} from "../actions";
import styles from "./clients.module.css";

function conditionLabel(v:string|null|undefined){if(v==="critical")return"Kritikus";if(v==="attention")return"Figyelmet igényel";if(v==="good")return"Rendben";return"Nincs szemle"}

export default async function ClientsPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farmers},{data:farms},{data:fields},{data:inspections},{data:tasks},{data:reports}]=await Promise.all([
  supabase.from("profiles").select("id,full_name,phone").eq("role","farmer").order("full_name"),
  supabase.from("farms").select("id,name,settlement,owner_id").order("created_at",{ascending:false}),
  supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").order("created_at",{ascending:false}),
  supabase.from("inspections").select("field_id,condition,inspected_at").order("inspected_at",{ascending:false}),
  supabase.from("tasks").select("farm_id,field_id,status,due_date").neq("status","done"),
  supabase.from("farmer_reports").select("field_id,status").neq("status","closed")
 ]);
 const latest=new Map<string,any>();for(const i of inspections??[])if(i.field_id&&!latest.has(i.field_id))latest.set(i.field_id,i);
 const totalArea=(fields??[]).reduce((s,f)=>s+Number(f.area_ha||0),0);
 const clientRows=(farmers??[]).map(f=>{const ownFarms=(farms??[]).filter(x=>x.owner_id===f.id);const farmIds=ownFarms.map(x=>x.id);const ownFields=(fields??[]).filter(x=>farmIds.includes(x.farm_id));const fieldIds=ownFields.map(x=>x.id);const area=ownFields.reduce((s,x)=>s+Number(x.area_ha||0),0);const critical=ownFields.filter(x=>latest.get(x.id)?.condition==="critical").length;const attention=ownFields.filter(x=>latest.get(x.id)?.condition==="attention").length;const openTasks=(tasks??[]).filter(t=>farmIds.includes(t.farm_id)||fieldIds.includes(t.field_id)).length;const openReports=(reports??[]).filter(r=>fieldIds.includes(r.field_id)).length;const last=(inspections??[]).find(i=>fieldIds.includes(i.field_id));const score=critical*100+attention*30+openReports*20+openTasks*10;return{farmer:f,ownFarms,ownFields,area,critical,attention,openTasks,openReports,last,score}}).sort((a,b)=>b.score-a.score||String(a.farmer.full_name||"").localeCompare(String(b.farmer.full_name||""),"hu"));
 return <main className={`admin-shell ${styles.scope}`}>
  <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI ÜGYFÉLKÖZPONT</span><h1>Ügyfelek</h1><p>Egy helyen az összes gazdálkodó, gazdaság, földtábla és aktuális szakmai állapot.</p></div></header>
  <AdminNav active="clients"/>
  <section className="admin-overview-grid"><article className="admin-overview-card"><span>Ügyfelek</span><strong>{farmers?.length??0}</strong><small>gazdálkodó</small></article><article className="admin-overview-card"><span>Gazdaságok</span><strong>{farms?.length??0}</strong><small>nyilvántartott gazdaság</small></article><article className="admin-overview-card"><span>Földtáblák</span><strong>{fields?.length??0}</strong><small>kezelt tábla</small></article><article className="admin-overview-card"><span>Kezelt terület</span><strong>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})}</strong><small>hektár összesen</small></article></section>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ÜGYFÉLLISTA</span><h2>Gazdálkodók szakmai állapota</h2></div></div>{clientRows.length?<div className="advisor-client-list">{clientRows.map(r=>{const overall=r.critical?"Kritikus":r.attention?"Figyelmet igényel":"Rendben";return <Link href={`/admin/clients/${r.farmer.id}`} className="advisor-client-card" key={r.farmer.id}><span className="advisor-client-avatar">{(r.farmer.full_name||"G").slice(0,2).toUpperCase()}</span><div><strong>{r.farmer.full_name||"Névtelen ügyfél"}</strong><small>{r.farmer.phone||"Nincs telefonszám"}</small><small>{r.ownFarms.length} gazdaság · {r.ownFields.length} tábla · {r.area.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</small></div><div className="advisor-client-stats"><span>{overall}</span><span>{r.critical} kritikus · {r.attention} figyelmeztetés</span><span>{r.openTasks} nyitott feladat · {r.openReports} bejelentés</span><span>Utolsó szemle: {r.last?.inspected_at?new Date(r.last.inspected_at).toLocaleDateString("hu-HU"):"—"}</span></div><b>Ügyfél megnyitása →</b></Link>})}</div>:<div className="empty-state">Még nincs ügyfél.</div>}</section>
  <section className="admin-grid"><article className="panel"><span className="eyebrow">ÚJ ÜGYFÉL</span><h2>Gazdálkodó meghívása</h2><form action={inviteFarmer} className="admin-form"><label>Gazdálkodó neve<input name="full_name" required/></label><label>E-mail cím<input name="email" type="email" required/></label><button className="btn btn-primary">Meghívó küldése</button></form></article><article className="panel"><span className="eyebrow">GYORS BŐVÍTÉS</span><h2>Gazdaság / tábla felvétele</h2><form action={createFarm} className="admin-form"><label>Gazdálkodó<select name="owner_id" required><option value="">Válassz ügyfelet</option>{farmers?.map(f=><option key={f.id} value={f.id}>{f.full_name}</option>)}</select></label><label>Gazdaság neve<input name="name" required/></label><label>Település<input name="settlement"/></label><label>Cím<input name="address"/></label><button className="btn btn-secondary">Gazdaság létrehozása</button></form><hr style={{border:0,borderTop:"1px solid #e5e9e5",margin:"20px 0"}}/><form action={createField} className="admin-form"><label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms?.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Tábla neve<input name="name" required/></label><label>Terület (ha)<input name="area_ha" inputMode="decimal"/></label><label>Kultúra<input name="current_crop"/></label><button className="btn btn-secondary">Tábla létrehozása</button></form></article></section>
 </main>
}
