import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {syncWeatherNow} from "./actions";
import styles from "./weather.module.css";

function fmt(v:string|null|undefined){return v?new Date(v).toLocaleString("hu-HU"):"—"}

export default async function SystemAdminWeatherPage(){
 const supabase=createAdminClient();
 const[{data:runs},{data:weather},{data:fields}]=await Promise.all([
  supabase.from("weather_sync_runs").select("id,started_at,finished_at,status,fields_total,fields_synced,fields_skipped,stations_requested,stations_failed,observations_upserted,timeline_inserted,error_summary").order("started_at",{ascending:false}).limit(8),
  supabase.from("field_weather_daily").select("field_id,weather_date,fetched_at,provider,station_name,distance_km").order("weather_date",{ascending:false}).limit(500),
  supabase.from("fields").select("id,center_lat,center_lng,boundary_geojson")
 ]);
 const fieldIds=new Set((weather??[]).map(x=>x.field_id));
 const mappable=(fields??[]).filter(f=>(f.center_lat!=null&&f.center_lng!=null)||!!f.boundary_geojson).length;
 const latest=(weather??[])[0];
 const cronConfigured=Boolean(process.env.CRON_SECRET);
 return <main className={styles.page}>
  <header className={styles.header}>
   <div><span>HUNGAROMET · HIVATALOS ODP</span><h1>Időjárási adatkapcsolat</h1><p>Napi automatikus állomási adatok, táblaszintű hozzárendeléssel és egyértelmű forrásmegjelöléssel.</p></div>
   <Link href="/system-admin">← Rendszeráttekintés</Link>
  </header>

  <section className={styles.summary}>
   <article><small>Cron állapot</small><strong className={cronConfigured?styles.ok:styles.warn}>{cronConfigured?"Konfigurálva":"CRON_SECRET hiányzik"}</strong><span>Vercel napi szinkron</span></article>
   <article><small>Mérhető táblák</small><strong>{mappable}</strong><span>Koordinátával / geometriával</span></article>
   <article><small>Időjárási adattal</small><strong>{fieldIds.size}</strong><span>Legalább egy HungaroMet sor</span></article>
   <article><small>Legfrissebb adat</small><strong className={styles.date}>{latest?.weather_date||"—"}</strong><span>{latest?fmt(latest.fetched_at):"Még nincs szinkron"}</span></article>
  </section>

  <section className={styles.panel}>
   <div className={styles.panelHead}><div><span>KÉZI VISSZAELLENŐRZÉS</span><h2>Szinkron futtatása most</h2><p>A kézi futtatás ugyanazt a fail-safe szinkronmotort használja, mint a napi Vercel Cron.</p></div>
    <form action={syncWeatherNow}><button type="submit">HungaroMet szinkron indítása →</button></form>
   </div>
   <div className={styles.notes}>
    <p><b>Forrás:</b> HungaroMet Meteorológiai Adattár – automata állomások napi adatai.</p>
    <p><b>Jelentés:</b> a <strong>MÉRT</strong> adat a kiválasztott hivatalos mérőállomás mérése; nem állítjuk, hogy a tábla területén fizikailag mért érték.</p>
    <p><b>Napi csapadék:</b> a HungaroMet dokumentáció szerint 06 UTC–következő nap 06 UTC időszakra vonatkozik.</p>
    <a href="https://odp.met.hu/climate/observations_hungary/daily/recent/Leiras_automata_napi-HABP_1D_akt-hu.pdf" target="_blank" rel="noreferrer">Hivatalos adatsor-leírás ↗</a>
   </div>
  </section>

  <section className={styles.panel}>
   <div className={styles.panelHead}><div><span>ÜZEMELTETÉSI BIZONYÍTÉK</span><h2>Legutóbbi szinkronok</h2></div></div>
   {runs?.length?<div className={styles.runList}>{runs.map(run=><article key={run.id}><div><strong>{run.status==="success"?"Sikeres":run.status==="partial"?"Részleges":run.status==="failed"?"Sikertelen":"Fut"}</strong><small>{fmt(run.started_at)} → {fmt(run.finished_at)}</small></div><dl><div><dt>Táblák</dt><dd>{run.fields_synced??0}/{run.fields_total??0}</dd></div><div><dt>Állomások</dt><dd>{run.stations_requested??0}</dd></div><div><dt>Hibás állomás</dt><dd>{run.stations_failed??0}</dd></div><div><dt>Adatsor</dt><dd>{run.observations_upserted??0}</dd></div><div><dt>Idővonal</dt><dd>{run.timeline_inserted??0}</dd></div></dl>{Array.isArray(run.error_summary)&&run.error_summary.length>0&&<pre>{JSON.stringify(run.error_summary,null,2)}</pre>}</article>)}</div>:<div className={styles.empty}>Még nincs rögzített időjárási szinkronfutás.</div>}
  </section>
 </main>;
}
