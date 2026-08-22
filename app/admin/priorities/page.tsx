import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {evaluateFieldHealth} from "@/lib/fieldHealth";

export default async function AdminPrioritiesPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:fields},{data:farms},{data:farmers},{data:inspections},{data:tasks},{data:reports}]=await Promise.all([
  supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").order("name"),
  supabase.from("farms").select("id,name,owner_id").order("name"),
  supabase.from("profiles").select("id,full_name").eq("role","farmer"),
  supabase.from("inspections").select("field_id,condition,inspected_at").order("inspected_at",{ascending:false}),
  supabase.from("tasks").select("field_id,status,due_date,priority,title"),
  supabase.from("farmer_reports").select("field_id,status,created_at,title")
 ]);
 const farmMap=new Map((farms??[]).map(x=>[x.id,x]));const ownerMap=new Map((farmers??[]).map(x=>[x.id,x.full_name]));
 const latest=new Map<string,any>();for(const i of inspections??[])if(i.field_id&&!latest.has(i.field_id))latest.set(i.field_id,i);
 const rows=(fields??[]).map(field=>{const health=evaluateFieldHealth({inspection:latest.get(field.id),tasks:(tasks??[]).filter(t=>t.field_id===field.id),reports:(reports??[]).filter(r=>r.field_id===field.id)});const farm=farmMap.get(field.farm_id);return{field,farm,owner:farm?ownerMap.get(farm.owner_id):null,health}}).sort((a,b)=>b.health.score-a.health.score||a.field.name.localeCompare(b.field.name,"hu"));
 const critical=rows.filter(r=>r.health.status==="critical").length,attention=rows.filter(r=>r.health.status==="attention").length,good=rows.filter(r=>r.health.status==="good").length;
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">NAPI MUNKASORREND</span><h1>Mi igényel ma figyelmet?</h1><p>A rendszer automatikusan sorba rendezi a földtáblákat a szakmai kockázat és a nyitott ügyek alapján.</p></div></header><AdminNav active="priorities"/>
 <section className="admin-overview-grid"><article className="admin-overview-card"><span>Kritikus</span><strong>{critical}</strong><small>azonnali figyelmet igényel</small></article><article className="admin-overview-card"><span>Figyelmeztetés</span><strong>{attention}</strong><small>ellenőrzendő tábla</small></article><article className="admin-overview-card"><span>Rendben</span><strong>{good}</strong><small>nincs nyitott szakmai jelzés</small></article><article className="admin-overview-card"><span>Összes tábla</span><strong>{rows.length}</strong><small>prioritás szerint rendezve</small></article></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">PRIORITÁSI LISTA</span><h2>Mai munkalista</h2></div><Link className="ghost-btn" href="/admin/map">Térképes nézet →</Link></div>
 <div style={{display:"grid",gap:10}}>{rows.length?rows.map((r,index)=>{const bg=r.health.status==="critical"?"#fff2f0":r.health.status==="attention"?"#fff8e8":"#f2f8f1";const border=r.health.status==="critical"?"#e6b7b1":r.health.status==="attention"?"#ead59e":"#cfe2cb";const color=r.health.status==="critical"?"#a72f27":r.health.status==="attention"?"#916512":"#34753a";return <article key={r.field.id} style={{display:"grid",gridTemplateColumns:"52px minmax(0,1fr) auto",gap:14,alignItems:"center",padding:"14px 16px",border:`1px solid ${border}`,borderRadius:12,background:bg}}><span style={{width:40,height:40,borderRadius:10,display:"grid",placeItems:"center",fontWeight:900,color,background:"#fff"}}>{index+1}</span><div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:15}}>{r.field.name}</strong><span style={{fontSize:10,fontWeight:900,color,border:`1px solid ${border}`,borderRadius:999,padding:"4px 8px",background:"#fff"}}>{r.health.label}</span></div><small style={{display:"block",marginTop:4,color:"#6f7c74"}}>{r.owner||"Gazdálkodó"} · {r.farm?.name||"Gazdaság"} · {r.field.area_ha?`${r.field.area_ha} ha`:"—"} · {r.field.current_crop||"Nincs kultúra"}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{r.health.reasons.map(reason=><span key={reason} style={{fontSize:10,padding:"4px 7px",borderRadius:7,background:"#fff",border:`1px solid ${border}`,color}}>{reason}</span>)}</div></div><div style={{display:"grid",gap:7,minWidth:130}}><Link className="btn btn-primary" href={`/fields/${r.field.id}`}>Adatlap</Link><Link className="ghost-btn" href={`/admin/map?field=${r.field.id}`}>Térképen</Link></div></article>}):<div className="empty-state">Még nincs kiértékelhető földtábla.</div>}</div></section></main>
}
