import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {ImportForm} from "./ImportForm";

export const maxDuration=60;

export default async function PlantProtectionImportPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:sources},{data:batches},{data:skProducts}]=await Promise.all([
  supabase.from("operation_catalog_sources").select("country_code,source_name,source_url,last_imported_at,product_count,use_count,status,notes").in("country_code",["HU","SK"]).order("country_code"),
  supabase.from("plant_protection_import_batches").select("id,country_code,source_name,imported_at,row_count,product_count,use_count,ingredient_count").order("imported_at",{ascending:false}).limit(10),
  supabase.from("plant_protection_products").select("id").eq("country_code","SK")
 ]);
 const skIds=(skProducts??[]).map(x=>x.id);
 let skCoverage={uses:0,dose:0,bbch:0,water:0,restrictions:0,timing:0};
 if(skIds.length){
  const count=async(filter:(q:any)=>any)=>{let total=0;for(let i=0;i<skIds.length;i+=100){const q=supabase.from("plant_protection_uses").select("id",{count:"exact",head:true}).in("product_id",skIds.slice(i,i+100));const{count}=await filter(q);total+=count??0}return total};
  const[uses,dose,bbch,water,restrictions,timing]=await Promise.all([
   count(q=>q),
   count(q=>q.not("dose_max","is",null)),
   count(q=>q.not("bbch_min","is",null)),
   count(q=>q.or("water_volume_min.not.is.null,water_volume_max.not.is.null")),
   count(q=>q.not("restrictions","is",null)),
   count(q=>q.not("application_timing","is",null))
  ]);
  skCoverage={uses,dose,bbch,water,restrictions,timing};
 }
 const pct=(n:number)=>skCoverage.uses?Math.round(n/skCoverage.uses*100):0;
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">NÖVÉNYVÉDELEM</span><h1>Növényvédőszer-katalógus</h1><p>Hivatalos Nébih és ÚKSÚP/ISPOR forrásadatok kezelése a készítmény–kultúra–felhasználás–dózis katalógusban. Ez katalóguskezelés, nem gazdasági kijuttatási jóváhagyás.</p></div></header><AdminNav active="plant-protection-import"/>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SZEREPKÖR</span><h2>Mit végez itt a szaktanácsadó?</h2></div></div><p>A szaktanácsadó ezen az oldalon a hivatalos növényvédőszer-adatforrásokat kezeli és ellenőrzi. A gazdaság által rögzített engedélyköteles kijuttatást nem a szaktanácsadó hagyja jóvá; azt a gazdasághoz rendelt megfelelő jogosultságú személy végzi.</p></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ÁLLAPOT</span><h2>Betöltött katalógusok</h2></div></div><div className="stats-grid">{["HU","SK"].map(c=>{const s=sources?.find(x=>x.country_code===c);return <article className="stat-card" key={c}><span>{c==="HU"?"Magyarország":"Szlovákia"}</span><strong>{s?.product_count??0}</strong><small>{s?.use_count??0} felhasználás · {s?.status||"nincs import"}{s?.last_imported_at?` · ${new Date(s.last_imported_at).toLocaleString("hu-HU")}`:""}</small></article>})}</div><p style={{marginTop:12}}>A hivatalos forrásadatot a rendszer nem egészíti ki kitalált dózissal. A konkrét felhasználásnál mindig a hatályos engedélyokirat az irányadó.</p></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ÚKSÚP ADATMINŐSÉG</span><h2>Szlovák részletes felhasználási lefedettség</h2></div></div>{skCoverage.uses?<><div className="stats-grid"><article className="stat-card"><span>Felhasználási rekord</span><strong>{skCoverage.uses}</strong><small>kultúra–cél kapcsolatok</small></article><article className="stat-card"><span>Dózissal</span><strong>{pct(skCoverage.dose)}%</strong><small>{skCoverage.dose} rekord</small></article><article className="stat-card"><span>BBCH-val</span><strong>{pct(skCoverage.bbch)}%</strong><small>{skCoverage.bbch} rekord</small></article><article className="stat-card"><span>Vízmennyiséggel</span><strong>{pct(skCoverage.water)}%</strong><small>{skCoverage.water} rekord</small></article><article className="stat-card"><span>Korlátozással</span><strong>{pct(skCoverage.restrictions)}%</strong><small>{skCoverage.restrictions} rekord</small></article><article className="stat-card"><span>Alkalmazási idővel</span><strong>{pct(skCoverage.timing)}%</strong><small>{skCoverage.timing} rekord</small></article></div><p style={{marginTop:12}}>Ez a blokk megmutatja, hogy az ÚKSÚP készítménytörzs mögött mennyi ténylegesen használható, részletes engedélyezési adat áll rendelkezésre. A 100% nem cél önmagában: csak a hivatalos forrásban ténylegesen szereplő adat kerülhet be.</p></>:<div className="empty-state">A szlovák készítménytörzs már betölthető, de részletes kultúra–cél–dózis rekord még nincs. A lenti részletes ÚKSÚP importtal tölthető fel.</div>}</section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">KATALÓGUS FRISSÍTÉS</span><h2>Hivatalos források</h2></div></div><ImportForm/></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ELŐZMÉNY</span><h2>Legutóbbi importok</h2></div></div>{batches?.length?<div className="inspection-list">{batches.map(b=><article className="inspection-card" key={b.id}><div className="inspection-head"><div><strong>{b.country_code} · {b.source_name}</strong><small>{new Date(b.imported_at).toLocaleString("hu-HU")}</small></div><span className="field-total">{b.row_count} sor</span></div><p>{b.product_count} új készítmény · {b.use_count} új felhasználás · {b.ingredient_count} új hatóanyag</p></article>)}</div>:<div className="empty-state">Még nincs katalógusimport.</div>}</section>
 </main>
}
