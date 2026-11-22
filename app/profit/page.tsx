import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {BlockHelpButton} from "@/components/GuidedTour";
import {calculateProfit} from "@/lib/profitMath";
import {ProfitCostForm,ProfitDeleteButton,ProfitSaleForm,ProfitSeasonForm} from "./ProfitForms";
import type {ProfitFieldOption,ProfitSeasonOption} from "./ProfitForms";
import styles from "./profit.module.css";

const money=(n:number)=>`${Math.round(n).toLocaleString("hu-HU")} Ft`;
const tonnes=(n:number)=>`${n.toLocaleString("hu-HU",{maximumFractionDigits:3})} t`;
type SeasonRow=ProfitSeasonOption&{farm_id:string;area_ha_snapshot:number};
type EntryRow={id:string;season_id:string;entry_type:"cost"|"sale";category:string;description:string;amount_huf:number|null;quantity_tonnes:number|null;price_huf_per_tonne:number|null;occurred_on:string};

export default async function ProfitPage({searchParams}:{searchParams:Promise<{season?:string;year?:string;new?:string}>}){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");
 if(profile?.role==="advisor")redirect("/admin");
 if(profile?.role!=="farmer")redirect("/dashboard");
 const params=await searchParams;
 const queryYear=Number(params.year),year=Number.isInteger(queryYear)&&queryYear>=2000&&queryYear<=2100?queryYear:new Date().getFullYear();
 const{data:farms,error:farmsError}=await supabase.from("farms").select("id,name").eq("owner_id",user.id).order("name");
 if(farmsError)throw new Error("Nem sikerült betölteni a saját gazdaságokat.");
 const farmNames=new Map((farms??[]).map(f=>[f.id,f.name]));
 const farmIds=(farms??[]).map(f=>f.id);
 const{data:fields,error:fieldsError}=farmIds.length?await supabase.from("fields").select("id,farm_id,name,area_ha,current_crop,crop_year,status").in("farm_id",farmIds).eq("status","active").order("name"):{data:[],error:null};
 if(fieldsError)throw new Error("Nem sikerült betölteni a földtáblákat.");
 const fieldMap=new Map((fields??[]).map(f=>[f.id,f]));
 const fieldOptions:ProfitFieldOption[]=(fields??[]).map(f=>({id:f.id,farmName:farmNames.get(f.farm_id)??"Gazdaság",name:f.name,areaHa:Number(f.area_ha||0),crop:f.current_crop??"",year:f.crop_year??year}));
 const{data:seasons,error:seasonError}=farmIds.length?await supabase.from("field_profit_seasons").select("id,farm_id,field_id,season_year,crop_name,area_ha_snapshot,harvested_tonnes,expected_price_huf_per_tonne").in("farm_id",farmIds).eq("created_by",user.id).order("season_year",{ascending:false}):{data:[],error:null};
 const available=!seasonError;
 const seasonRows:SeasonRow[]=(seasons??[]).map(s=>({id:s.id,farm_id:s.farm_id,field_id:s.field_id,season_year:s.season_year,crop_name:s.crop_name,area_ha_snapshot:Number(s.area_ha_snapshot),harvested_tonnes:Number(s.harvested_tonnes),expected_price_huf_per_tonne:Number(s.expected_price_huf_per_tonne)}));
 const seasonIds=seasonRows.map(s=>s.id);
 const{data:entries,error:entriesError}=available&&seasonIds.length?await supabase.from("field_profit_entries").select("id,season_id,entry_type,category,description,amount_huf,quantity_tonnes,price_huf_per_tonne,occurred_on").in("season_id",seasonIds).eq("created_by",user.id).order("occurred_on",{ascending:false}):{data:[],error:null};
 const entryRows:EntryRow[]=(entries??[]).map(e=>({id:e.id,season_id:e.season_id,entry_type:e.entry_type as "cost"|"sale",category:e.category,description:e.description,amount_huf:e.amount_huf===null?null:Number(e.amount_huf),quantity_tonnes:e.quantity_tonnes===null?null:Number(e.quantity_tonnes),price_huf_per_tonne:e.price_huf_per_tonne===null?null:Number(e.price_huf_per_tonne),occurred_on:e.occurred_on}));
 const summaries=seasonRows.map(s=>({...s,fieldName:fieldMap.get(s.field_id)?.name??"Földtábla",farmName:farmNames.get(s.farm_id)??"Gazdaság",entries:entryRows.filter(e=>e.season_id===s.id),totals:calculateProfit({harvestedTonnes:s.harvested_tonnes,expectedPriceHufPerTonne:s.expected_price_huf_per_tonne,areaHa:s.area_ha_snapshot,entries:entryRows.filter(e=>e.season_id===s.id)})}));
 const yearSummaries=summaries.filter(s=>s.season_year===year),active=params.new==="1"?undefined:summaries.find(s=>s.id===params.season)??yearSummaries[0];
 const yearTotals=yearSummaries.reduce((sum,s)=>({cost:sum.cost+s.totals.totalCost,revenue:sum.revenue+s.totals.realizedRevenue,result:sum.result+s.totals.realizedResult,forecast:sum.forecast+s.totals.projectedResult}),{cost:0,revenue:0,result:0,forecast:0});
 const currentEntries=active?.entries??[];
 const futureYearOptions=[year-2,year-1,year,year+1].filter(y=>y>=2000&&y<=2100);
 return <div className="app-shell farmer-app"><Sidebar active="profit" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><FarmerTopbar userName={profile?.full_name||"Gazdálkodó"}/>
  <div className={styles.page}>
   <header className={styles.hero}>
    <small>AGRÁR MENTOR · GAZDASÁGI EREDMÉNY</small>
    <h1>Jövedelmezőség és profitmutató</h1>
    <p>Táblánként és termesztési évenként rögzítheted a kiadásokat, a betakarított terményt és az értékesítéseket. A tényleges eredményt külön mutatjuk a még el nem adott készlet becsült értékétől.</p>
   </header>
   <div className={styles.toolbar} data-help-block="profit-overview"><div><h2>{year}. évi gazdasági eredmény</h2><p style={{margin:0,fontSize:11,color:"#6d8172"}}>A saját gazdaságok felvett földtáblái alapján.</p></div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}><form action="/profit" className={styles.yearForm}><label htmlFor="profit-year">Év:</label><select name="year" id="profit-year" defaultValue={year}>{futureYearOptions.map(y=><option key={y}>{y}</option>)}</select><button>Mutasd</button></form><BlockHelpButton label="A profitmutató magyarázata" content={{title:"Gazdasági eredmény és profit",body:"A rögzített költségekből, termésből és eladásokból számított táblaszintű mutatók. A realizált eredmény csak tényleges eladást tartalmaz; a becsült eredmény a még el nem adott készlet várható árát is figyelembe veszi.",important:"Ez tervezési és döntéstámogatási kimutatás. Nem számviteli vagy adóbevallási eredmény. Az áfát, támogatásokat és közös gazdasági rezsit külön kell kezelni, amíg nincs hozzárendelve az adott táblához."}}/></div>
   </div>
   <section className={styles.metrics} aria-label="Éves eredmény mutatók">
    <article className={styles.metric}><small>Rögzített költségek</small><strong>{available&&!entriesError?money(yearTotals.cost):"—"}</strong><em>{yearSummaries.length} termesztési év adataiból</em></article>
    <article className={styles.metric}><small>Tényleges árbevétel</small><strong>{available&&!entriesError?money(yearTotals.revenue):"—"}</strong><em>Eladott termény alapján</em></article>
    <article className={`${styles.metric} ${yearTotals.result<0?styles.negative:""}`}><small>Realizált eredmény</small><strong>{available&&!entriesError?money(yearTotals.result):"—"}</strong><em>Árbevétel − összes költség</em></article>
    <article className={`${styles.metric} ${yearTotals.forecast<0?styles.negative:""}`}><small>Becsült teljes eredmény</small><strong>{available&&!entriesError?money(yearTotals.forecast):"—"}</strong><em>A készleten lévő terménnyel együtt</em></article>
   </section>
   {!available?<section className={styles.panel} role="status"><h2>A profitmodul adatbázisa még nincs aktiválva</h2><p>A számítási felület elkészült, de a pénzügyi táblák biztonsági telepítése még hátravan. Addig nem engedünk olyan mentést, amely elveszíthetné az adatokat.</p></section>:
    entriesError?<section className={styles.panel} role="alert"><h2>Az értékesítési és költségadatok nem olvashatók</h2><p>Próbáld újra később. A rendszer ilyenkor nem mutat hiányos pénzügyi összegeket.</p></section>:
    <div className={styles.columns}>
     <aside className={styles.panel} data-help-block="profit-seasons"><h2>Földtáblák és évek</h2><p>A költségeket és a termést minden földtáblához külön vedd fel.</p><Link href={`/profit?year=${year}&new=1`} className={styles.newSeasonLink}>+ Új termesztési év felvétele</Link>
      {summaries.length?<div className={styles.seasonList}>{summaries.map(s=><Link href={`/profit?year=${s.season_year}&season=${s.id}`} key={s.id} className={`${styles.seasonLink} ${active?.id===s.id?styles.selected:""}`}><strong>{s.fieldName} · {s.season_year}</strong><small>{s.farmName} · {s.crop_name} · {tonnes(s.harvested_tonnes)} termés</small></Link>)}</div>:<div className={styles.empty}>Még nem rögzítettél termesztési évet.</div>}
      <div style={{marginTop:18}}><ProfitSeasonForm key={active?.id??`new-${year}`} fields={fieldOptions} selected={active} defaultYear={year}/></div>
      {!fieldOptions.length&&<p className={styles.warning}>Előbb hozz létre egy saját gazdaságot és legalább egy földtáblát.</p>}
     </aside>
     <section className={styles.details}>
      {active?<>
       <article className={styles.panel} data-help-block="profit-detail">
        <div className={styles.detailsTop}><h2>{active.fieldName} – {active.crop_name}</h2><small>{active.season_year} · {active.area_ha_snapshot.toLocaleString("hu-HU")} ha</small></div>
        <div className={styles.innerMetrics}>
         <div className={styles.innerMetric}><small>Betakarított termény</small><strong>{tonnes(active.harvested_tonnes)}</strong></div>
         <div className={styles.innerMetric}><small>Eladott / megmaradt</small><strong>{tonnes(active.totals.soldTonnes)} / {tonnes(active.totals.unsoldTonnes)}</strong></div>
         <div className={styles.innerMetric}><small>Fedezeti ár</small><strong>{active.totals.breakEvenPricePerTonne===null?"—":`${money(active.totals.breakEvenPricePerTonne)}/t`}</strong></div>
         <div className={styles.innerMetric}><small>Költség hektáronként</small><strong>{active.totals.costPerHa===null?"—":`${money(active.totals.costPerHa)}/ha`}</strong></div>
         <div className={styles.innerMetric}><small>Becsült eredmény hektáronként</small><strong>{active.totals.projectedResultPerHa===null?"—":`${money(active.totals.projectedResultPerHa)}/ha`}</strong></div>
         <div className={styles.innerMetric}><small>Becsült eredményhányad</small><strong>{active.totals.marginPercent===null?"—":`${active.totals.marginPercent.toLocaleString("hu-HU")}%`}</strong></div>
        </div>
        {active.totals.oversold&&<p className={styles.warning}>A rögzített eladás meghaladja a betakarított mennyiséget. Ellenőrizd a készletet!</p>}
        <p className={styles.note}>Realizált eredmény: {money(active.totals.realizedResult)}. El nem adott termény becsült értéke: {money(active.totals.estimatedUnsoldRevenue)}. Várható teljes eredmény: {money(active.totals.projectedResult)}.</p>
       </article>
       <div className={styles.entryGrid} data-help-block="profit-entry-forms"><section className={styles.panel}><ProfitCostForm key={`cost-${active.id}`} seasonId={active.id}/></section><section className={styles.panel}><ProfitSaleForm key={`sale-${active.id}`} seasonId={active.id} availableTonnes={active.totals.unsoldTonnes}/></section></div>
       <div className={styles.entryGrid}>
        <section className={styles.panel}><h3>Költségtételek</h3>{currentEntries.filter(e=>e.entry_type==="cost").length?<ul className={styles.entryList}>{currentEntries.filter(e=>e.entry_type==="cost").map(e=><li className={styles.entry} key={e.id}><div><strong>{e.category}</strong><small>{e.occurred_on} · {e.description||"Nincs megjegyzés"}</small></div><div className={styles.entryAmount}><strong>{money(Number(e.amount_huf||0))}</strong><ProfitDeleteButton entryId={e.id}/></div></li>)}</ul>:<p>Nincs még rögzített költség.</p>}</section>
        <section className={styles.panel}><h3>Terményértékesítések</h3>{currentEntries.filter(e=>e.entry_type==="sale").length?<ul className={styles.entryList}>{currentEntries.filter(e=>e.entry_type==="sale").map(e=><li className={styles.entry} key={e.id}><div><strong>{tonnes(Number(e.quantity_tonnes||0))} · {money(Number(e.price_huf_per_tonne||0))}/t</strong><small>{e.occurred_on} · {e.description||"Értékesítés"}</small></div><div className={styles.entryAmount}><strong>{money(Number(e.quantity_tonnes||0)*Number(e.price_huf_per_tonne||0))}</strong><ProfitDeleteButton entryId={e.id}/></div></li>)}</ul>:<p>Még nem volt rögzített értékesítés.</p>}</section>
       </div>
      </>:<section className={styles.panel}><h2>Válassz egy földtáblát!</h2><p>Elsőként hozd létre a termesztési évet, majd add hozzá a költségeket és az értékesítéseket.</p></section>}
     </section>
    </div>}
   <aside className={styles.note}>A kimutatás a kézzel rögzített tételekből számol. A támogatások, áfa, értékcsökkenés és közös gazdasági költségek nincsenek automatikusan hozzárendelve. Emiatt ez gazdálkodási döntéstámogató mutató, nem hivatalos könyvelési eredmény.</aside>
  </div>
 </main></div>;
}
