import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {evaluateFieldHealth} from "@/lib/fieldHealth";
import {decodeSupervisionConfig,defaultSupervisionConfig,isSupervisionActive,SUPERVISION_EVENT,supervisionLabel} from "@/lib/supervision";
import {decodeHotspot,HOTSPOT_EVENT} from "@/lib/hotspots";

function fmt(v:string|null|undefined){return v?new Date(v).toLocaleDateString("hu-HU"):"—"}

export default async function AdminPortfolioPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farms},{data:fields},{data:farmers},{data:inspections},{data:tasks},{data:reports},{data:seasonEvents},{data:hotspotEvents}]=await Promise.all([
  supabase.from("farms").select("id,name,owner_id,settlement").order("name"),
  supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").order("name"),
  supabase.from("profiles").select("id,full_name,phone").eq("role","farmer"),
  supabase.from("inspections").select("id,field_id,condition,inspected_at,next_check_at,issue_status").order("inspected_at",{ascending:false}),
  supabase.from("tasks").select("id,field_id,farm_id,status,due_date,priority,title"),
  supabase.from("farmer_reports").select("id,field_id,status,created_at,title"),
  supabase.from("timeline_events").select("farm_id,description,event_at,created_at").eq("event_type",SUPERVISION_EVENT).order("event_at",{ascending:false}).limit(500),
  supabase.from("timeline_events").select("field_id,description,event_at,created_at").eq("event_type",HOTSPOT_EVENT).order("event_at",{ascending:false}).limit(2000)
 ]);
 const ownerMap=new Map((farmers??[]).map(x=>[x.id,x]));
 const latestInspection=new Map<string,any>();for(const i of inspections??[])if(i.field_id&&!latestInspection.has(i.field_id))latestInspection.set(i.field_id,i);
 const seasonMap=new Map<string,any>();for(const e of seasonEvents??[])if(e.farm_id&&!seasonMap.has(e.farm_id))seasonMap.set(e.farm_id,decodeSupervisionConfig(e.description)||defaultSupervisionConfig);
 const hotspotMap=new Map<string,any[]>();for(const e of hotspotEvents??[]){const h=decodeHotspot(e.description);if(!h||h.resolved||!e.field_id)continue;const list=hotspotMap.get(e.field_id)||[];list.push(h);hotspotMap.set(e.field_id,list)}
 const today=new Date().toISOString().slice(0,10);
 const rows=(farms??[]).map(farm=>{
  const farmFields=(fields??[]).filter(f=>f.farm_id===farm.id);const config=seasonMap.get(farm.id)||defaultSupervisionConfig;const active=isSupervisionActive(config);
  const health=farmFields.map(field=>evaluateFieldHealth({inspection:latestInspection.get(field.id),tasks:(tasks??[]).filter(t=>t.field_id===field.id),reports:(reports??[]).filter(r=>r.field_id===field.id),hotspots:hotspotMap.get(field.id)||[],supervision:config}));
  const critical=health.filter(h=>h.status==="critical").length,attention=health.filter(h=>h.status==="attention").length;
  const fieldIds=farmFields.map(f=>f.id);const farmTasks=(tasks??[]).filter(t=>t.farm_id===farm.id||fieldIds.includes(t.field_id));const overdue=farmTasks.filter(t=>t.status!=="done"&&t.due_date&&t.due_date<today).length;
  const openReports=(reports??[]).filter(r=>fieldIds.includes(r.field_id)&&r.status!=="closed").length;
  const dueChecks=(inspections??[]).filter(i=>fieldIds.includes(i.field_id)&&i.issue_status!=="resolved"&&i.next_check_at&&i.next_check_at<=today).length;
  const openHotspots=fieldIds.reduce((n,id)=>n+(hotspotMap.get(id)?.length||0),0);const area=farmFields.reduce((n,f)=>n+Number(f.area_ha||0),0);const last=(inspections??[]).find(i=>fieldIds.includes(i.field_id));
  const score=critical*100+attention*35+dueChecks*30+overdue*20+openReports*15+openHotspots*15+(active?5:0);
  const next=critical?"Kritikus tábla ellenőrzése":dueChecks?"Esedékes visszaellenőrzés":overdue?"Lejárt teendők áttekintése":openReports?"Gazdálkodói bejelentés megválaszolása":attention?"Figyelmeztetett táblák ellenőrzése":active?"Aktív szezon – nincs sürgős ügy":"Szezonon kívül";
  return{farm,owner:ownerMap.get(farm.owner_id),farmFields,config,active,critical,attention,overdue,openReports,dueChecks,openHotspots,area,last,score,next};
 }).sort((a,b)=>b.score-a.score||a.farm.name.localeCompare(b.farm.name,"hu"));
 const activeCount=rows.filter(r=>r.active).length,needsAction=rows.filter(r=>r.critical||r.attention||r.overdue||r.openReports||r.dueChecks||r.openHotspots).length,totalArea=rows.reduce((n,r)=>n+r.area,0),criticalClients=rows.filter(r=>r.critical>0).length;
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">ÜGYFÉLPORTFÓLIÓ</span><h1>Szaktanácsadói portfólió</h1><p>Cégenként egy helyen látszik, hol van aktív szezon, sürgős probléma vagy következő szakmai teendő.</p></div></header><AdminNav active="portfolio"/>
 <section className="admin-overview-grid"><article className="admin-overview-card"><span>Ügyfélgazdaságok</span><strong>{rows.length}</strong><small>{activeCount} aktív szezonban</small></article><article className="admin-overview-card"><span>Figyelmet igénylő ügyfél</span><strong>{needsAction}</strong><small>van nyitott szakmai ügy</small></article><article className="admin-overview-card"><span>Kritikus ügyfél</span><strong>{criticalClients}</strong><small>legalább egy piros tábla</small></article><article className="admin-overview-card"><span>Kezelt terület</span><strong>{totalArea.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</strong><small>összes ügyfél együtt</small></article></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">PORTFÓLIÓ SORREND</span><h2>Melyik ügyféllel érdemes most foglalkozni?</h2></div><Link className="ghost-btn" href="/admin/priorities">Táblaszintű prioritások →</Link></div><div style={{display:"grid",gap:12}}>{rows.map(r=>{const danger=r.critical>0,warn=!danger&&(r.attention>0||r.dueChecks>0||r.overdue>0||r.openReports>0||r.openHotspots>0);const border=danger?"#e2b1aa":warn?"#ead79f":"#dce5dc";const bg=danger?"#fff3f1":warn?"#fffaf0":"#f8faf7";return <article key={r.farm.id} style={{border:`1px solid ${border}`,background:bg,borderRadius:14,padding:16,display:"grid",gap:12}}><div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}><div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><h3 style={{margin:0,fontSize:18}}>{r.farm.name}</h3><span className="user-pill">{r.active?"Aktív szezon":"Szezonon kívül"}</span>{r.critical>0&&<span className="user-pill" style={{fontWeight:900}}>🔴 {r.critical} kritikus</span>}{!r.critical&&r.attention>0&&<span className="user-pill">🟡 {r.attention} figyelmeztetés</span>}</div><small style={{display:"block",marginTop:5,color:"#6f7c74"}}>{r.owner?.full_name||"Gazdálkodó"}{r.farm.settlement?` · ${r.farm.settlement}`:""} · {r.farmFields.length} tábla · {r.area.toLocaleString("hu-HU",{maximumFractionDigits:1})} ha</small><small style={{display:"block",marginTop:4,color:"#7b867f"}}>{supervisionLabel(r.config)} · utolsó szemle: {fmt(r.last?.inspected_at)}</small></div><div style={{display:"grid",gap:7,minWidth:180}}><Link className="btn btn-primary" href={`/admin/priorities`}>Szakmai részletek</Link><Link className="ghost-btn" href={`/admin/map`}>Térképes nézet</Link></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8}}><div className="stat-card"><span>Visszaellenőrzés</span><strong>{r.dueChecks}</strong></div><div className="stat-card"><span>Lejárt teendő</span><strong>{r.overdue}</strong></div><div className="stat-card"><span>Bejelentés</span><strong>{r.openReports}</strong></div><div className="stat-card"><span>Problémagóc</span><strong>{r.openHotspots}</strong></div><div className="stat-card"><span>Következő lépés</span><strong style={{fontSize:14,lineHeight:1.25}}>{r.next}</strong></div></div></article>})}</div></section>
 </main>
}
