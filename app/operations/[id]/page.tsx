import Link from "next/link";
import {redirect,notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {BlockHelpButton} from "@/components/GuidedTour";
import {OperationCompliancePanel} from "@/components/OperationCompliancePanel";
import {complianceFromOperationSnapshot} from "@/lib/operationComplianceSnapshot";
import {operationLabel} from "@/lib/operations";

function huDate(v:string|null){return v?new Date(v.includes("T")?v:`${v}T12:00:00`).toLocaleString("hu-HU"):"—"}
function value(v:unknown,unit=""){return v==null||v===""?"—":`${String(v)}${unit?` ${unit}`:""}`}
function range(a:unknown,b:unknown,unit=""){if(a==null&&b==null)return"—";if(a!=null&&b!=null&&String(a)!==String(b))return`${a}–${b}${unit?` ${unit}`:""}`;return value(b??a,unit)}
const auditLabel:Record<string,string>={created:"Létrehozva",updated:"Módosítva",approval_requested:"Jóváhagyásra küldve",approved:"Jóváhagyva",approval_invalidated:"Jóváhagyás érvénytelenítve",deleted:"Törölve"};

export default async function OperationDetailPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params,supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");
 const{data:op}=await supabase.from("field_operations").select("*").eq("id",id).maybeSingle();if(!op)notFound();
 const[{data:farm},{data:field},{data:audit}]=await Promise.all([
  supabase.from("farms").select("name,country_code").eq("id",op.farm_id).maybeSingle(),
  supabase.from("fields").select("name,area_ha,current_crop").eq("id",op.field_id).maybeSingle(),
  supabase.from("field_operation_audit_log").select("id,action,changed_at,changed_by,changed_fields").eq("operation_id",id).order("changed_at",{ascending:false})
 ]);
 const actorIds=Array.from(new Set((audit??[]).map(a=>a.changed_by).filter(Boolean)));
 const{data:actors}=actorIds.length?await supabase.from("profiles").select("id,full_name").in("id",actorIds):{data:[]};
 const actorMap=new Map((actors??[]).map(a=>[a.id,a.full_name]));
 const reg=(op.regulatory_snapshot&&typeof op.regulatory_snapshot==="object"?op.regulatory_snapshot:{}) as Record<string,any>;
 const cat=(op.catalog_snapshot&&typeof op.catalog_snapshot==="object"?op.catalog_snapshot:{}) as Record<string,any>;
 const composition=(op.composition&&typeof op.composition==="object"?op.composition:{}) as Record<string,any>;
 const nutrients=Object.entries(composition).filter(([k,v])=>["N","P2O5","K2O","CaO","MgO","S"].includes(k)&&typeof v==="number");
 const isPlant=op.operation_type==="spraying"||op.operation_type==="plant_protection";
 const complianceChecks=isPlant?complianceFromOperationSnapshot({country:op.country_code||farm?.country_code,operationDate:op.operation_date,dose:op.dose,doseUnit:op.dose_unit,approvalRequired:op.approval_required,approvalStatus:op.approval_status,regulatory:reg}):[];
 return <div className="app-shell farmer-app"><Sidebar active="operations" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard">
  <header className="topbar"><div><span className="eyebrow">MŰVELETI ADATLAP</span><h1>{operationLabel(op.operation_type)}</h1><p>{farm?.name||"Gazdaság"} · {field?.name||"Földtábla"} · {op.country_code}</p></div><Link className="ghost-btn" href={profile?.role==="advisor"?"/admin/operations":"/operations"}>Vissza a naplóhoz</Link></header>

  <section className="panel" data-help-block="operation-detail"><div className="panel-heading"><div><span className="eyebrow">RÖGZÍTETT ADATOK</span><h2>Végleges műveleti adatlap</h2></div><div style={{display:"flex",gap:8,alignItems:"center"}}><span className="user-pill">{op.approval_status==="approved"?"Jóváhagyva":op.approval_status==="pending"?"Jóváhagyásra vár":"Nem jóváhagyásköteles"}</span><BlockHelpButton label="A műveleti adatlap magyarázata" content={{title:"Végleges műveleti adatlap",body:"A művelet rögzített és auditálható adatai. Hivatalos növényvédelmi tételnél az engedélyezési pillanatkép is megmarad.",important:"A pillanatkép a rögzítéskori katalógusadatot őrzi meg. A tényleges kijuttatásnál mindig a művelet napján hatályos engedélyokirat az irányadó.",steps:["Ellenőrizd a dátumot és a földtáblát.","Nézd meg az anyagot vagy munkafolyamatot.","Növényvédelemnél ellenőrizd a hivatalos felhasználási pillanatképet.","Ellenőrizd a dózist, a végrehajtót és a jóváhagyási állapotot."]}}/></div></div>
   <div className="field-meta"><span><b>{op.operation_date}</b><small>Dátum</small></span><span><b>{field?.name||"—"}</b><small>Földtábla</small></span><span><b>{value(op.treated_area,"ha")}</b><small>Kezelt terület</small></span><span><b>{op.operator_name||"—"}</b><small>Végrehajtó</small></span></div>
   <div className="field-meta"><span><b>{op.product_name||op.subtype||"—"}</b><small>Anyag / munkafolyamat</small></span><span><b>{op.crop||field?.current_crop||"—"}</b><small>Kultúra</small></span><span><b>{op.target||"—"}</b><small>Cél</small></span><span><b>{op.dose!=null?`${op.dose} ${op.dose_unit||""}`:"—"}</b><small>Dózis</small></span></div>
   {op.quantity!=null&&<p>Mennyiség: <b>{op.quantity} {op.quantity_unit||""}</b></p>}{op.machine_name&&<p>Gép: <b>{op.machine_name}</b></p>}{op.weather&&<p>Időjárás / körülmények: <b>{op.weather}</b></p>}{op.notes&&<p>Megjegyzés: {op.notes}</p>}
   {op.approval_required&&<p>Gazdasági jóváhagyó: <b>{op.approver_name||"kijelölve"}</b> · állapot: <b>{op.approval_status}</b>{op.approved_at?` · ${huDate(op.approved_at)}`:""}</p>}
  </section>

  {isPlant&&<OperationCompliancePanel checks={complianceChecks} title="A rögzített növényvédelmi művelet megfelelősége"/>}

  {isPlant&&Object.keys(reg).length>0&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">HIVATALOS PILLANATKÉP</span><h2>{op.country_code==="SK"?"ÚKSÚP":"Magyar"} engedélyezési adatok a rögzítéskor</h2></div><span className="user-pill">{reg.source_name||"Hivatalos katalógus"}</span></div>
   <div className="field-meta"><span><b>{reg.product_name||op.product_name||"—"}</b><small>Készítmény</small></span><span><b>{reg.authorization_number||op.authorization_number||"—"}</b><small>Engedélyszám</small></span><span><b>{reg.crop||op.crop||"—"}</b><small>Engedélyezett kultúra</small></span><span><b>{reg.target||op.target||"—"}</b><small>Cél / károsító</small></span></div>
   <div className="field-meta"><span><b>{range(reg.dose_min,reg.dose_max,reg.dose_unit||op.dose_unit||"")}</b><small>Engedélyezett dózis</small></span><span><b>{range(reg.bbch_min,reg.bbch_max)}</b><small>BBCH</small></span><span><b>{value(reg.max_applications)}</b><small>Max. kezelésszám</small></span><span><b>{value(reg.application_interval_days,"nap")}</b><small>Kezelések közötti minimum</small></span></div>
   <div className="field-meta"><span><b>{range(reg.water_volume_min,reg.water_volume_max,reg.water_volume_unit||"l/ha")}</b><small>Vízmennyiség</small></span><span><b>{reg.application_method||"—"}</b><small>Kijuttatási mód</small></span><span><b>{value(reg.phi_days,"nap")}</b><small>Élelmezés-egészségügyi várakozási idő</small></span><span><b>{reg.active_ingredient||op.active_ingredient||"—"}</b><small>Hatóanyag</small></span></div>
   {reg.application_timing&&<p><b>Alkalmazási idő:</b> {reg.application_timing}</p>}{reg.restrictions&&<div style={{padding:12,border:"1px solid #e0b85d",borderRadius:10,background:"#fffaf0"}}><b>⚠ Korlátozás / külön feltétel:</b> {reg.restrictions}</div>}
   <p style={{color:"#607066"}}>Forrás: <b>{reg.source_reference||reg.source_name||"hivatalos engedélyforrás"}</b>{reg.source_checked_at?` · ellenőrizve: ${huDate(reg.source_checked_at)}`:""}. A művelet végrehajtásánál a művelet napján hatályos hivatalos engedélyokirat az irányadó.</p>
  </section>}

  {!isPlant&&Object.keys(cat).length>0&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">KATALÓGUS PILLANATKÉP</span><h2>Országfüggő műveleti törzs</h2></div><span className="user-pill">{cat.country_code||op.country_code}</span></div><p>Katalóguselem: <b>{cat.name||op.product_name||op.subtype}</b></p>{nutrients.length>0&&<div className="field-meta">{nutrients.map(([k,v])=><span key={k}><b>{String(v)}%</b><small>{k}</small></span>)}</div>}</section>}

  <section className="panel" data-help-block="operation-audit"><div className="panel-heading"><div><span className="eyebrow">AUDIT NAPLÓ</span><h2>Módosítási és jóváhagyási történet</h2></div><BlockHelpButton label="Az auditnapló magyarázata" content={{title:"Műveleti auditnapló",body:"Az auditnapló megőrzi a létrehozás, módosítás és jóváhagyás eseményeit.",important:"Lényeges módosítás után a korábbi jóváhagyás érvénytelenné válhat.",steps:["Nézd meg a legfrissebb eseményt.","Ellenőrizd, ki és mikor módosított.","Jóváhagyott műveletnél ellenőrizd a jóváhagyási eseményt."]}}/></div>{audit?.length?<div className="inspection-list">{audit.map(a=><article className="inspection-card" key={a.id}><div className="inspection-head"><div><strong>{auditLabel[a.action]||a.action}</strong><small>{huDate(a.changed_at)} · {a.changed_by?actorMap.get(a.changed_by)||"Felhasználó":"Rendszer"}</small></div></div>{a.changed_fields?.length>0&&<p>Módosított mezők: {a.changed_fields.join(", ")}</p>}</article>)}</div>:<div className="empty-state">Ehhez a művelethez még nincs auditbejegyzés.</div>}</section>
 </main></div>;
}
