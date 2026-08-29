import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {AdminDeleteButton} from "@/components/AdminDeleteButton";
import {FarmCreateWithContacts} from "@/components/FarmCreateWithContacts";
import {BlockHelpButton} from "@/components/GuidedTour";
import {inviteFarmer,createField} from "../actions";
import styles from "./clients.module.css";

function dateLabel(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}

export default async function ClientsPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farmers},{data:farms},{data:fields},{data:inspections},{data:tasks},{data:reports}]=await Promise.all([
  supabase.from("profiles").select("id,full_name,phone").eq("role","farmer").order("full_name"),
  supabase.from("farms").select("id,name,settlement,address,owner_id").order("name"),
  supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").order("name"),
  supabase.from("inspections").select("field_id,condition,inspected_at,next_check_at,issue_status").order("inspected_at",{ascending:false}),
  supabase.from("tasks").select("farm_id,field_id,status,due_date").neq("status","done"),
  supabase.from("farmer_reports").select("field_id,status,created_at").neq("status","closed")
 ]);
 const latest=new Map<string,any>();for(const i of inspections??[])if(i.field_id&&!latest.has(i.field_id))latest.set(i.field_id,i);
 const today=new Date().toISOString().slice(0,10);
 const totalArea=(fields??[]).reduce((s,f)=>s+Number(f.area_ha||0),0);
 const clientRows=(farmers??[]).map(f=>{
  const ownFarms=(farms??[]).filter(x=>x.owner_id===f.id),farmIds=ownFarms.map(x=>x.id),ownFields=(fields??[]).filter(x=>farmIds.includes(x.farm_id)),fieldIds=ownFields.map(x=>x.id);
  const area=ownFields.reduce((s,x)=>s+Number(x.area_ha||0),0),critical=ownFields.filter(x=>latest.get(x.id)?.condition==="critical").length,attention=ownFields.filter(x=>latest.get(x.id)?.condition==="attention").length;
  const openTasks=(tasks??[]).filter(t=>farmIds.includes(t.farm_id)||fieldIds.includes(t.field_id)),overdue=openTasks.filter(t=>t.due_date&&t.due_date<today).length,openReports=(reports??[]).filter(r=>fieldIds.includes(r.field_id)).length;
  const dueChecks=(inspections??[]).filter(i=>fieldIds.includes(i.field_id)&&i.issue_status!=="resolved"&&i.next_check_at&&i.next_check_at<=today).length,last=(inspections??[]).find(i=>fieldIds.includes(i.field_id));
  const score=critical*100+attention*35+dueChecks*25+overdue*20+openReports*15;
  return{farmer:f,ownFarms,ownFields,area,critical,attention,openTasks:openTasks.length,overdue,openReports,dueChecks,last,score};
 }).sort((a,b)=>b.score-a.score||String(a.farmer.full_name||"").localeCompare(String(b.farmer.full_name||""),"hu"));
 const problemClients=clientRows.filter(r=>r.critical||r.attention||r.overdue||r.openReports||r.dueChecks).length;
 return <main className={`admin-shell ${styles.scope}`}>
  <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI ÜGYFÉLKÖZPONT</span><h1>Ügyfelek</h1><p>Innen indul az ügyfél → gazdaság → földtábla → szakmai előzmény munkafolyamat.</p></div></header>
  <AdminNav active="clients"/>
  <section className="admin-overview-grid" data-help-block="client-summary"><div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end"}}><BlockHelpButton label="Az ügyfél-összesítő magyarázata" content={{title:"Ügyfélállomány összesítése",body:"A négy kártya a kezelt ügyfelek, hozzájuk rendelt gazdaságok, földtáblák és teljes kezelt terület számát mutatja. Az Ügyfelek kártya külön jelzi, hány gazdálkodónál van kritikus vagy figyelmet igénylő állapot, lejárt feladat, nyitott jelzés vagy esedékes visszaellenőrzés.",important:"Ez az összesítő munkaszervezési áttekintés. A konkrét szakmai okot mindig az ügyfélkártyán vagy a dossziéban ellenőrizd."}}/></div>
   <article className="admin-overview-card"><span>Ügyfelek</span><strong>{farmers?.length??0}</strong><small>{problemClients} figyelmet igényel</small></article>
   <article className="admin-overview-card"><span>Gazdaságok</span><strong>{farms?.length??0}</strong><small>ügyfelekhez rendelve</small></article>
   <article className="admin-overview-card"><span>Földtáblák</span><strong>{fields?.length??0}</strong><small>szakmai nyilvántartásban</small></article>
   <article className="admin-overview-card"><span>Kezelt terület</span><strong>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})}</strong><small>hektár összesen</small></article>
  </section>
  <section className="panel" data-help-block="client-list">
   <div className="panel-heading"><div><span className="eyebrow">ÜGYFÉLLISTA</span><h2>Gazdálkodók, gazdaságok és aktuális szakmai állapot</h2></div><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><BlockHelpButton label="Az ügyféllista magyarázata" content={{title:"Gazdálkodói ügyféllista",body:"Az ügyfelek sürgősségi pontszám szerint rendezve jelennek meg. Kártyánként látszik a gazdálkodó elérhetősége, gazdaságai, földtáblái, kezelt területe, kritikus és figyelmeztető táblaállapotai, esedékes visszaellenőrzései, nyitott és lejárt feladatai, valamint nyitott gazdálkodói jelzései.",important:"A sorrend munkaszervezési döntéstámogatás. A Dosszié megnyitása oldalon kell ellenőrizni a teljes szakmai előzményt és a konkrét beavatkozási okot."}}/><Link className="ghost-btn" href="/admin/priorities">Mai prioritások →</Link></div></div>
   {clientRows.length?<div className="advisor-client-list">{clientRows.map(r=>{const state=r.critical?"🔴 Kritikus":r.attention||r.overdue||r.dueChecks?"🟡 Figyelmet igényel":"🟢 Rendben";return <article className="advisor-client-card" key={r.farmer.id}>
    <span className="advisor-client-avatar">{(r.farmer.full_name||"G").slice(0,2).toUpperCase()}</span>
    <div style={{minWidth:0}}><strong>{r.farmer.full_name||"Névtelen ügyfél"}</strong><small>{r.farmer.phone||"Nincs telefonszám"}</small><small>{r.ownFarms.length} gazdaság · {r.ownFields.length} tábla · {r.area.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</small>
     <div style={{display:"grid",gap:8,marginTop:10}}>{r.ownFarms.length?r.ownFarms.map(f=>{const farmFields=r.ownFields.filter(field=>field.farm_id===f.id);return <div key={f.id} style={{padding:"10px",border:"1px solid #e2e8e2",borderRadius:8,background:"#f8faf8"}}>
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap"}}><div><strong style={{display:"block",fontSize:13}}>{f.name}</strong><small style={{display:"block"}}>{f.settlement||"Nincs település"}{f.address?` · ${f.address}`:""}</small></div><AdminDeleteButton type="farm" id={f.id} name={f.name}/></div>
      {farmFields.length?<div style={{display:"grid",gap:5,marginTop:8}}>{farmFields.map(field=><div key={field.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 8px",background:"#fff",borderRadius:7,border:"1px solid #e7ece7"}}><Link href={`/fields/${field.id}`} style={{minWidth:0}}><strong style={{display:"block",fontSize:12}}>{field.name}</strong><small>{field.area_ha?`${field.area_ha} ha · `:""}{field.current_crop||"Nincs kultúra"}</small></Link><AdminDeleteButton type="field" id={field.id} name={field.name}/></div>)}</div>:<small style={{display:"block",marginTop:8}}>Nincs földtábla ebben a gazdaságban.</small>}
     </div>}):<small style={{marginTop:8}}>Ehhez az ügyfélhez még nincs gazdaság rögzítve.</small>}</div>
    </div>
    <div className="advisor-client-stats"><span>{state}</span><span>{r.critical} kritikus · {r.attention} figyelmeztetés · {r.dueChecks} visszaellenőrzés</span><span>{r.openTasks} feladat ({r.overdue} lejárt) · {r.openReports} jelzés</span><span>Utolsó szemle: {dateLabel(r.last?.inspected_at)}</span></div>
    <Link href={`/admin/clients/${r.farmer.id}`} className="ghost-btn">Dosszié megnyitása →</Link>
   </article>})}</div>:<div className="empty-state">Még nincs ügyfél.</div>}
  </section>
  <details className="panel" data-help-block="client-create" style={{marginTop:14}}><summary style={{cursor:"pointer",padding:18,fontWeight:800}}>＋ Ügyfél, gazdaság vagy földtábla felvétele</summary><div style={{padding:"0 18px 18px"}}><div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><BlockHelpButton label="Az ügyfél-, gazdaság- és táblafelvétel magyarázata" content={{title:"Új ügyfélstruktúra létrehozása",body:"Ebben a kinyitható blokkban három külön művelet érhető el: új gazdálkodó meghívása, új gazdaság létrehozása egy gazdálkodóhoz, illetve új földtábla felvétele egy meglévő gazdaságba.",important:"Tartsd meg a hierarchiát: először gazdálkodó, utána hozzá tartozó gazdaság, majd a gazdaság földtáblái. Így a későbbi szemlék, feladatok, dokumentumok és műveletek megfelelő ügyfélhez kapcsolódnak."}}/></div><div className="admin-grid">
   <article><span className="eyebrow">ÚJ ÜGYFÉL</span><h2>Gazdálkodó meghívása</h2><form action={inviteFarmer} className="admin-form"><label>Gazdálkodó neve<input name="full_name" required/></label><label>E-mail cím<input name="email" type="email" required/></label><button className="btn btn-primary">Meghívó küldése</button></form></article>
   <article><span className="eyebrow">ÚJ GAZDASÁG</span><h2>Gazdaság felvétele</h2><FarmCreateWithContacts farmers={farmers??[]}/></article>
  </div><hr style={{border:0,borderTop:"1px solid #e5e9e5",margin:"20px 0"}}/><div style={{maxWidth:620}}><span className="eyebrow">ÚJ FÖLDTÁBLA</span><h2>Földtábla felvétele</h2><form action={createField} className="admin-form"><label>Gazdaság<select name="farm_id" required><option value="">Válassz gazdaságot</option>{farms?.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Tábla neve<input name="name" required/></label><label>Terület (ha)<input name="area_ha" inputMode="decimal"/></label><label>Kultúra<input name="current_crop"/></label><button className="btn btn-secondary">Tábla létrehozása</button></form></div></div></details>
 </main>;
}
