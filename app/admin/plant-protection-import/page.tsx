import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {ImportForm} from "./ImportForm";

export const maxDuration=60;

export default async function PlantProtectionImportPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:sources},{data:batches}]=await Promise.all([supabase.from("operation_catalog_sources").select("country_code,source_name,source_url,last_imported_at,product_count,use_count,status,notes").in("country_code",["HU","SK"]).order("country_code"),supabase.from("plant_protection_import_batches").select("id,country_code,source_name,imported_at,row_count,product_count,use_count,ingredient_count").order("imported_at",{ascending:false}).limit(10)]);
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">NÖVÉNYVÉDELEM</span><h1>Növényvédőszer-katalógus</h1><p>Hivatalos Nébih és ÚKSÚP/ISPOR forrásadatok kezelése a készítmény–kultúra–felhasználás–dózis katalógusban. Ez katalóguskezelés, nem gazdasági kijuttatási jóváhagyás.</p></div></header><AdminNav active="plant-protection-import"/>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SZEREPKÖR</span><h2>Mit végez itt a szaktanácsadó?</h2></div></div><p>A szaktanácsadó ezen az oldalon a hivatalos növényvédőszer-adatforrásokat kezeli és ellenőrzi. A gazdaság által rögzített engedélyköteles kijuttatást nem a szaktanácsadó hagyja jóvá; azt a gazdasághoz rendelt megfelelő jogosultságú személy végzi.</p></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ÁLLAPOT</span><h2>Betöltött katalógusok</h2></div></div><div className="stats-grid">{["HU","SK"].map(c=>{const s=sources?.find(x=>x.country_code===c);return <article className="stat-card" key={c}><span>{c==="HU"?"Magyarország":"Szlovákia"}</span><strong>{s?.product_count??0}</strong><small>{s?.use_count??0} felhasználás · {s?.status||"nincs import"}{s?.last_imported_at?` · ${new Date(s.last_imported_at).toLocaleString("hu-HU")}`:""}</small></article>})}</div><p style={{marginTop:12}}>A hivatalos forrásadatot a rendszer nem egészíti ki kitalált dózissal. A konkrét felhasználásnál mindig a hatályos engedélyokirat az irányadó.</p></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">KATALÓGUS FRISSÍTÉS</span><h2>Hivatalos források</h2></div></div><ImportForm/></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ELŐZMÉNY</span><h2>Legutóbbi importok</h2></div></div>{batches?.length?<div className="inspection-list">{batches.map(b=><article className="inspection-card" key={b.id}><div className="inspection-head"><div><strong>{b.country_code} · {b.source_name}</strong><small>{new Date(b.imported_at).toLocaleString("hu-HU")}</small></div><span className="field-total">{b.row_count} sor</span></div><p>{b.product_count} új készítmény · {b.use_count} új felhasználás · {b.ingredient_count} új hatóanyag</p></article>)}</div>:<div className="empty-state">Még nincs katalógusimport.</div>}</section>
 </main>
}
