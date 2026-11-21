import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {syncWeatherNow} from "./actions";
import styles from "./weather.module.css";

function fmt(v:string|null|undefined){return v?new Date(v).toLocaleString("hu-HU"):"—"}
function issueText(value:unknown){
 if(!value||typeof value!=="object")return String(value);
 const item=value as {reason?:unknown;error?:unknown;count?:unknown;stationNumber?:unknown};
 const station=item.stationNumber?`Állomás ${String(item.stationNumber)}: `:"";
 const count=typeof item.count==="number"?` (${item.count} tábla)`:"";
 return `${station}${String(item.reason??item.error??"Ismeretlen ok")}${count}`;
}

export default async function SystemAdminWeatherPage({searchParams}:{searchParams:Promise<{sync?:string}>}){
 const{sync}=await searchParams;
 const supabase=createAdminClient();
 const[{data:runs,error:runsError},{data:weather,error:weatherError},{count:weatherCount},{count:fieldsCount}]=await Promise.all([
  supabase.from("weather_sync_runs").select("id,started_at,finished_at,status,fields_total,fields_synced,fields_skipped,stations_requested,stations_failed,observations_upserted,timeline_inserted,error_summary").order("started_at",{ascending:false}).limit(8),
  supabase.from("field_weather_daily").select("field_id,weather_date,fetched_at,provider,station_name,distance_km").eq("source_type","measured").eq("provider","HungaroMet").order("weather_date",{ascending:false}).limit(1),
  supabase.from("field_weather_daily").select("id",{count:"exact",head:true}).eq("source_type","measured").eq("provider","HungaroMet"),
  supabase.from("fields").select("id",{count:"exact",head:true})
 ]);
 const latest=(weather??[])[0];
 const cronConfigured=Boolean(process.env.CRON_SECRET);
 const lastRun=(runs??[])[0]??null;
 const lastRunOld=lastRun?.started_at?Date.now()-new Date(lastRun.started_at).getTime()>48*60*60*1000:false;
 const latestDataOld=latest?.weather_date?Date.now()-new Date(`${latest.weather_date}T12:00:00Z`).getTime()>4*24*60*60*1000:false;
 const hasNoMeasurements=(fieldsCount??0)>0&&weatherCount===0;
 return <main className={styles.page}>
  <header className={styles.header}>
   <div><span>HUNGAROMET · HIVATALOS ODP</span><h1>Időjárási adatkapcsolat</h1><p>Napi automatikus állomási adatok, táblaszintű hozzárendeléssel és egyértelmű forrásmegjelöléssel.</p></div>
   <Link href="/system-admin">← Rendszeráttekintés</Link>
  </header>

  <section className={styles.summary} data-help-block="admin-weather-summary">
   <article><small>Cron hozzáférési kulcs</small><strong className={cronConfigured?styles.ok:styles.warn}>{cronConfigured?"Beállítva":"CRON_SECRET hiányzik"}</strong><span>A kulcs önmagában nem bizonyít futást</span></article>
   <article><small>Földtáblák</small><strong>{fieldsCount??"—"}</strong><span>Összes nyilvántartott tábla</span></article>
   <article><small>Mérési adatsorok</small><strong>{weatherCount??"—"}</strong><span>Összes rögzített napi mérés</span></article>
   <article><small>Legfrissebb adat</small><strong className={styles.date}>{latest?.weather_date||"—"}</strong><span>{latest?fmt(latest.fetched_at):"Még nincs szinkron"}</span></article>
  </section>

  {(sync==="success"||sync==="partial"||sync==="failed")&&<section role="status" style={{margin:"12px 0",padding:"12px 16px",borderRadius:10,background:sync==="success"?"#edf8ed":"#fff8e8",color:sync==="success"?"#255d31":"#79490e",fontSize:12}}>
   {sync==="success"?"A kézi HungaroMet-szinkron lefutott. Az eredmények lent ellenőrizhetők.":sync==="partial"?"A kézi szinkron részlegesen sikerült. Néhány tábla vagy állomás adata hiányzik; az okok a futásnaplóban láthatók.":"A kézi HungaroMet-szinkron sikertelen volt. Ellenőrizd a futásnaplót és a szervernaplót."}
  </section>}

  {(runsError||weatherError||!lastRun||lastRunOld||latestDataOld||hasNoMeasurements||lastRun.status==="failed"||lastRun.status==="partial")&&<section role="status" style={{margin:"12px 0",padding:"14px 16px",border:"1px solid #ead09b",background:"#fff8e8",borderRadius:10,color:"#79490e",fontSize:12,lineHeight:1.5}}>
   <strong>Figyelem: az automatikus csapadéknapló működése nincs teljesen igazolva.</strong>
   {runsError||weatherError?<p>Nem sikerült kiolvasni a szinkron ellenőrző adatait. {runsError?.message||weatherError?.message}</p>:!lastRun?<p>Még egyetlen szinkronfutás sincs naplózva. A Vercel időzített feladata kizárólag az éles környezetben indul automatikusan; a fejlesztői előnézetben nem. Ellenőrizni kell az éles telepítést és az ottani CRON_SECRET beállítást.</p>:lastRun.status==="failed"?<p>Az utolsó szinkron hibával végződött. A részletek lent, a futásnaplóban láthatók.</p>:lastRun.status==="partial"?<p>Az utolsó szinkron csak részben sikerült. A kihagyott táblák és állomások okai a futásnaplóban láthatók.</p>:hasNoMeasurements?<p>Vannak földtáblák, de még nincs eltárolt napi HungaroMet-mérés. A szinkron tényleges adatbeérkezését ellenőrizni kell.</p>:latestDataOld?<p>A legfrissebb tárolt mérési nap több mint 4 napos. A szinkron ugyan futhatott, de az aktuális csapadékadat még nem igazolt.</p>:<p>Az utolsó szinkron több mint 48 órája indult. Ellenőrizni kell az éles időzítést és a hivatalos adatforrás elérhetőségét.</p>}
  </section>}

  <section className={styles.panel} data-help-block="admin-weather-sync">
   <div className={styles.panelHead}><div><span>KÉZI VISSZAELLENŐRZÉS</span><h2>Szinkron futtatása most</h2><p>A kézi futtatás ugyanazt a fail-safe szinkronmotort használja, mint a napi Vercel Cron.</p></div>
    <form action={syncWeatherNow}><button type="submit">HungaroMet szinkron indítása →</button></form>
   </div>
   <div className={styles.notes}>
    <p><b>Forrás:</b> HungaroMet Meteorológiai Adattár – automata állomások napi adatai.</p>
    <p><b>Jelentés:</b> a <strong>MÉRT</strong> adat a kiválasztott hivatalos mérőállomás mérése; nem állítjuk, hogy a tábla területén fizikailag mért érték.</p>
    <p><b>Napi csapadék:</b> a HungaroMet dokumentáció szerint 06 UTC–következő nap 06 UTC időszakra vonatkozik. A 0 mm mért, csapadékmentes nap; hiányzó adat esetén nem jelenítünk meg kitalált 0 mm-t.</p>
    <p><b>Fontos:</b> a kézi szinkron valódi mérési sorokat és idővonaleseményeket írhat az adatbázisba. A hétvégi közös teszt előtt nem szükséges elindítani.</p>
    <a href="https://odp.met.hu/climate/observations_hungary/daily/recent/Leiras_automata_napi-HABP_1D_akt-hu.pdf" target="_blank" rel="noreferrer">Hivatalos adatsor-leírás ↗</a>
   </div>
  </section>

  <section className={styles.panel} data-help-block="admin-weather-history">
   <div className={styles.panelHead}><div><span>ÜZEMELTETÉSI BIZONYÍTÉK</span><h2>Legutóbbi szinkronok</h2></div></div>
   {runs?.length?<div className={styles.runList}>{runs.map(run=><article key={run.id}><div><strong>{run.status==="success"?"Sikeres":run.status==="partial"?"Részleges":run.status==="failed"?"Sikertelen":"Fut"}</strong><small>{fmt(run.started_at)} → {fmt(run.finished_at)}</small></div><dl><div><dt>Táblák</dt><dd>{run.fields_synced??0}/{run.fields_total??0}</dd></div><div><dt>Állomások</dt><dd>{run.stations_requested??0}</dd></div><div><dt>Hibás állomás</dt><dd>{run.stations_failed??0}</dd></div><div><dt>Adatsor</dt><dd>{run.observations_upserted??0}</dd></div><div><dt>Idővonal</dt><dd>{run.timeline_inserted??0}</dd></div></dl>{Array.isArray(run.error_summary)&&run.error_summary.length>0&&<ul style={{paddingLeft:18,margin:"12px 0 0",fontSize:11,lineHeight:1.6,color:"#8a3030"}}>{run.error_summary.map((issue:unknown,i:number)=><li key={i}>{issueText(issue)}</li>)}</ul>}</article>)}</div>:<div className={styles.empty}>Még nincs rögzített időjárási szinkronfutás.</div>}
  </section>
 </main>;
}
