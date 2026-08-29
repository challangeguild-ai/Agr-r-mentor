import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import {BlockHelpButton} from "@/components/GuidedTour";

function statusLabel(status: string | null) {if(status==="inactive")return"Inaktív";if(status==="archived")return"Archivált";return"Aktív"}
function inspectionLabel(v:string|null|undefined){if(v==="good")return"Jó állapot";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}
type SearchParams = Promise<{ view?: string }>;

export default async function FieldsPage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "all" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,system_role,full_name").eq("id", user.id).maybeSingle();
  if(profile?.system_role==="admin") redirect("/system-admin");
  if(profile?.role==="advisor") redirect("/admin/map");

  const {data:farms,error:farmError}=await supabase.from("farms").select("id,name,settlement").eq("owner_id",user.id).order("name");
  if(farmError)throw new Error(farmError.message);
  const farmIds=(farms??[]).map(f=>f.id);
  const {data:fields,error}=farmIds.length?await supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,crop_year,sowing_date,status,created_at").in("farm_id",farmIds).order("name"):{data:[],error:null};
  if (error) throw new Error(error.message);
  const fieldIds=(fields??[]).map(f=>f.id);
  const [{data:tasks},{data:inspections}]=fieldIds.length?await Promise.all([
    supabase.from("tasks").select("id,field_id,status,due_date,priority").in("field_id",fieldIds).eq("assigned_to",user.id),
    supabase.from("inspections").select("id,field_id,condition,inspected_at").in("field_id",fieldIds).order("inspected_at",{ascending:false})
  ]):[{data:[]},{data:[]}];
  const latestInspection=new Map<string,any>();for(const i of inspections??[])if(!latestInspection.has(i.field_id))latestInspection.set(i.field_id,i);

  const totalArea=(fields??[]).reduce((sum,field)=>sum+(Number(field.area_ha)||0),0);const active=(fields??[]).filter(field=>field.status!=="inactive"&&field.status!=="archived").length;const openTasks=(tasks??[]).filter(task=>task.status!=="done").length;
  const attentionIds=new Set((fields??[]).filter(field=>{const ins=latestInspection.get(field.id);const important=(tasks??[]).some(t=>t.field_id===field.id&&t.status!=="done"&&(t.priority==="urgent"||t.priority==="high"));return important||ins?.condition==="attention"||ins?.condition==="critical"}).map(f=>f.id));
  const noTaskIds=new Set((fields??[]).filter(field=>!(tasks??[]).some(task=>task.field_id===field.id&&task.status!=="done")).map(field=>field.id));
  const visibleFields=(fields??[]).filter(field=>{if(view==="active")return field.status!=="inactive"&&field.status!=="archived";if(view==="attention")return attentionIds.has(field.id);if(view==="no-tasks")return noTaskIds.has(field.id);if(view==="archived")return field.status==="archived"||field.status==="inactive";return true});
  const tabs=[["all","Összes",fields?.length??0],["active","Aktív",active],["attention","Figyelmet igényel",attentionIds.size],["no-tasks","Nincs nyitott teendő",noTaskIds.size],["archived","Inaktív / archivált",(fields??[]).length-active]] as const;

  return <div className="app-shell farmer-app"><Sidebar active="fields" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><header className="topbar"><div><span className="eyebrow">FÖLDTERÜLETEK</span><h1>Táblák</h1><p>Minden földtábla egy helyen, kultúrával, szakmai állapottal és aktuális feladatokkal.</p></div></header><section className="stats-grid"><article className="stat-card"><span>Összes tábla</span><strong>{fields?.length??0}</strong><small>Nyilvántartott földtábla</small></article><article className="stat-card"><span>Aktív</span><strong>{active}</strong><small>Aktív művelésben</small></article><article className="stat-card"><span>Figyelmet igényel</span><strong>{attentionIds.size}</strong><small>Szemle vagy fontos teendő alapján</small></article><article className="stat-card"><span>Összterület</span><strong>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha</strong><small>{openTasks} nyitott teendő</small></article></section><section className="panel" data-help-block="fields-register"><div className="panel-heading"><div><span className="eyebrow">FÖLDTÁBLÁK</span><h2>Táblajegyzék</h2></div><div style={{display:"flex",gap:8,alignItems:"center"}}><span className="field-total">{visibleFields.length} tábla</span><BlockHelpButton label="A táblajegyzék magyarázata" content={{title:"Földtáblák és szakmai állapot",body:"A táblajegyzékben minden földterületet egy kártyán látsz, a gazdasággal, területtel, kultúrával, legutóbbi szemleállapottal és nyitott teendőkkel együtt.",important:"A Figyelmet igényel szűrőbe olyan tábla kerülhet, ahol a legutóbbi szemle figyelmeztető vagy kritikus, illetve fontos vagy sürgős nyitott teendő tartozik hozzá. Ez prioritási segítség, nem önálló szakmai diagnózis.",example:"Példa: a Déli 12 táblán kritikus szemle van és egy sürgős teendő. A Figyelmet igényel fülön azonnal megtalálod, majd a kártyára kattintva megnyitod a teljes táblaprofilját.",steps:["A felső összesítőben nézd meg az aktív és figyelmet igénylő táblák számát.","Használd a szűrőfüleket a megfelelő csoport kiválasztásához.","A kártyán ellenőrizd a kultúrát, szakmai állapotot és nyitott teendőket.","Kattints a tábla kártyájára a részletes adatlaphoz, térképhez, szemlékhez és műveletekhez.","Az inaktív vagy archivált területeket külön szűrőn keresztül keresd vissza."]}}/></div></div><div className="task-filter-tabs">{tabs.map(([key,label,count])=><Link key={key} className={view===key?"active":""} href={`/fields?view=${key}`}>{label} <b>{count}</b></Link>)}</div>{visibleFields.length?<div className="field-overview-grid">{visibleFields.map(field=>{const farm=farms?.find(item=>item.id===field.farm_id);const fieldTasks=(tasks??[]).filter(task=>task.field_id===field.id&&task.status!=="done");const importantTasks=fieldTasks.filter(task=>task.priority==="urgent"||task.priority==="high").length;const ins=latestInspection.get(field.id);return <Link className="field-card field-card-link" href={`/fields/${field.id}`} key={field.id}><div className="field-card-top"><span className="field-icon">{field.name.slice(0,1).toUpperCase()}</span><div><strong>{field.name}</strong><small>{farm?.name||"Gazdaság"}{farm?.settlement?` · ${farm.settlement}`:""}</small></div><span className="field-arrow">→</span></div><div className="field-meta"><span><b>{field.area_ha?`${field.area_ha} ha`:"—"}</b><small>Terület</small></span><span><b>{field.current_crop||"—"}</b><small>Kultúra</small></span><span><b>{inspectionLabel(ins?.condition)}</b><small>Szakmai állapot</small></span></div><div className="field-meta"><span><b>{statusLabel(field.status)}</b><small>Nyilvántartás</small></span><span><b>{fieldTasks.length}{importantTasks?` (${importantTasks} fontos)`:""}</b><small>Nyitott teendő</small></span><span><b>{ins?.inspected_at?new Date(ins.inspected_at).toLocaleDateString("hu-HU"):"—"}</b><small>Utolsó szemle</small></span></div></Link>})}</div>:<div className="empty-state">Ebben a nézetben nincs földtábla.</div>}</section></main></div>
}
