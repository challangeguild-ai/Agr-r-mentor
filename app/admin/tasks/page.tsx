import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {createTask} from "../actions";

function priorityLabel(v:string){if(v==="urgent")return"Sürgős";if(v==="high")return"Fontos";return"Normál"}
function dateKey(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function addDaysKey(days:number){const d=new Date();d.setDate(d.getDate()+days);return dateKey(d)}
function fmt(v:string|null){return v?new Intl.DateTimeFormat("hu-HU",{timeZone:"Europe/Budapest"}).format(new Date(`${v}T12:00:00`)):"Nincs határidő"}

type SP=Promise<{view?:string;priority?:string;farm?:string;field?:string}>;

export default async function TasksAdminPage({searchParams}:{searchParams:SP}){
  const{view="open",priority="all",farm:requestedFarm="",field:requestedField=""}=await searchParams;
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor")redirect("/dashboard");

  const[{data:farms},{data:fields},{data:tasks},{data:farmers}]=await Promise.all([
    supabase.from("farms").select("id,name,owner_id").order("name"),
    supabase.from("fields").select("id,name,farm_id").order("name"),
    supabase.from("tasks").select("id,title,description,due_date,priority,status,farm_id,field_id,created_at,completed_at").order("due_date",{ascending:true,nullsFirst:false}).limit(250),
    supabase.from("profiles").select("id,full_name").eq("role","farmer").order("full_name")
  ]);

  const requestedFieldRow=(fields??[]).find(f=>f.id===requestedField);
  const defaultField=requestedFieldRow?.id||"";
  const defaultFarm=(farms??[]).some(f=>f.id===requestedFarm)?requestedFarm:(requestedFieldRow?.farm_id||"");
  const today=dateKey(); const weekEnd=addDaysKey(7);
  const all=tasks??[]; const open=all.filter(t=>t.status!=="done"); const done=all.filter(t=>t.status==="done");
  const overdue=open.filter(t=>t.due_date&&t.due_date<today); const upcoming=open.filter(t=>t.due_date&&t.due_date>=today&&t.due_date<=weekEnd); const urgent=open.filter(t=>t.priority==="urgent"||t.priority==="high");
  const farmMap=new Map((farms??[]).map(f=>[f.id,f])); const fieldMap=new Map((fields??[]).map(f=>[f.id,f])); const ownerMap=new Map((farmers??[]).map(f=>[f.id,f]));
  const ownerName=(t:any)=>{const field=t.field_id?fieldMap.get(t.field_id):null;const farm=farmMap.get(t.farm_id||field?.farm_id);return ownerMap.get(farm?.owner_id)?.full_name||farm?.name||"—"};

  const visible=all.filter(t=>{
    const statusOk=view==="done"?t.status==="done":view==="overdue"?t.status!=="done"&&t.due_date&&t.due_date<today:view==="upcoming"?t.status!=="done"&&t.due_date&&t.due_date>=today&&t.due_date<=weekEnd:view==="all"?true:t.status!=="done";
    const prioOk=priority==="all"?true:priority==="important"?(t.priority==="high"||t.priority==="urgent"):t.priority===priority;
    return statusOk&&prioOk;
  });

  const q=(v:string,p=priority)=>`/admin/tasks?view=${v}&priority=${p}`;

  return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI VEZÉRLŐPULT</span><h1>Teendők</h1><p>Feladatkiadás, határidők és végrehajtás követése ügyfelenként.</p></div></header>
    <section className="admin-summary"><div><span>Nyitott</span><strong>{open.length}</strong></div><div><span>Lejárt</span><strong>{overdue.length}</strong></div><div><span>Sürgős / fontos</span><strong>{urgent.length}</strong></div></section>

    <section className="panel"><span className="eyebrow">ÚJ TEENDŐ</span><h2>Feladat kiadása</h2><form action={createTask} className="admin-form task-create-grid"><label>Gazdaság<select name="farm_id" required defaultValue={defaultFarm}><option value="">Válassz gazdaságot</option>{farms?.map(f=><option key={f.id} value={f.id}>{ownerMap.get(f.owner_id)?.full_name?`${ownerMap.get(f.owner_id)?.full_name} — `:""}{f.name}</option>)}</select></label><label>Földtábla<select name="field_id" defaultValue={defaultField}><option value="">Teljes gazdaság</option>{fields?.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Feladat<input name="title" required/></label><label>Határidő<input name="due_date" type="date"/></label><label>Prioritás<select name="priority"><option value="normal">Normál</option><option value="high">Fontos</option><option value="urgent">Sürgős</option></select></label><label className="task-description">Megjegyzés<input name="description"/></label><button className="btn btn-primary">Teendő kiadása</button></form></section>

    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">MUNKALISTA</span><h2>Kiadott teendők</h2></div><span className="user-pill">{visible.length} találat</span></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}><Link className="ghost-btn" href={q("open")}>Nyitott ({open.length})</Link><Link className="ghost-btn" href={q("overdue")}>Lejárt ({overdue.length})</Link><Link className="ghost-btn" href={q("upcoming")}>7 napon belül ({upcoming.length})</Link><Link className="ghost-btn" href={q("done")}>Elvégzett ({done.length})</Link><Link className="ghost-btn" href={q("all")}>Összes ({all.length})</Link></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}><Link className="ghost-btn" href={q(view,"all")}>Minden prioritás</Link><Link className="ghost-btn" href={q(view,"important")}>Sürgős + fontos</Link><Link className="ghost-btn" href={q(view,"urgent")}>Csak sürgős</Link></div>
      {visible.length?visible.map(t=>{const field=t.field_id?fieldMap.get(t.field_id):null;const farm=farmMap.get(t.farm_id||field?.farm_id);const late=t.status!=="done"&&t.due_date&&t.due_date<today;return <div className="task-admin-row" key={t.id}><span className={`dot ${t.priority}`}/><div><strong>{t.title}</strong><small>{ownerName(t)} · {field?.name||farm?.name||"Gazdaság"} · {priorityLabel(t.priority)}</small>{t.description&&<small>{t.description}</small>}</div><div><b style={late?{color:"#b33c2d"}:undefined}>{fmt(t.due_date)}</b><small>{t.status==="done"?"Kész":late?"Lejárt":"Nyitott"}</small></div>{t.field_id&&<Link href={`/fields/${t.field_id}`}>Megnyitás →</Link>}</div>}):<div className="empty-state">Ebben a nézetben nincs teendő.</div>}
    </section>
  </main>
}
