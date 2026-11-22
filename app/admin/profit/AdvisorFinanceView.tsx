import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {FinanceDenied,readAdvisorFinance} from "@/lib/advisorProfit";
import type {AdvisorFinanceFarm} from "@/lib/advisorProfit";
import styles from "./profitPrivacy.module.css";

const money=(n:number)=>`${Math.round(n).toLocaleString("hu-HU")} Ft`;
const tonnes=(n:number)=>`${n.toLocaleString("hu-HU",{maximumFractionDigits:3})} t`;
export default async function AdvisorFinanceView({searchParams}:{searchParams:Promise<{farm?:string}>}){
 const auth=await createClient();const{data:{user}}=await auth.auth.getUser();if(!user)redirect("/login");
 const{data:aal}=await auth.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")redirect("/mfa?next=/admin/profit");
 const{data:profile}=await auth.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role!=="advisor")redirect("/dashboard");
 const params=await searchParams;
 let farms:AdvisorFinanceFarm[]=[];
 try{farms=await readAdvisorFinance(user.id,params.farm||undefined)}catch(e){if(e instanceof FinanceDenied)redirect("/admin/profit");throw e}
 const seasons=farms.flatMap(f=>f.seasons);
 const cost=seasons.reduce((sum,s)=>sum+s.totals.totalCost,0),revenue=seasons.reduce((sum,s)=>sum+s.totals.realizedRevenue,0),projected=seasons.reduce((sum,s)=>sum+s.totals.projectedResult,0);
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI PORTÁL · PÉNZÜGYI BETEKINTÉS</span><h1>Jövedelmezőség</h1><p>Pontos összegek kizárólag dokumentált hozzáférésű gazdaságokhoz.</p></div></header>
  <section className={styles.hero} data-help-block="advisor-profit-privacy"><span className={styles.lock} aria-hidden="true">▥</span><div><small>JOGOSÍTOTT GAZDASÁGI PÉNZÜGYEK</small><h2>Pontos eredmények, valódi adatokból</h2><p>A pénzügyi betekintés naplózott és csak aktív, gazdaságonkénti jogosultsággal használható.</p></div></section>
  <section className={styles.notice} data-help-block="advisor-profit-reason"><div className={styles.noticeIcon} aria-hidden="true">i</div><div><h2>Hozzáférési feltételek</h2><p>A pénzügyi nyilvántartás szerkesztése továbbra is a gazda joga. A szaktanácsadó az adminisztrátor által dokumentáltan hozzá rendelt gazdaságok adatait láthatja; a megtekintésekről napló készül. <Link href="/adatkezeles">Adatkezelési tájékoztatás.</Link></p></div></section>
  {!farms.length?<section className={styles.notice} role="status"><div><h2>Még nincs pénzügyi hozzáférés</h2><p>A rendszeradminisztrátor nem rögzített hozzárendelést. Ettől a szakmai ügyfélfunkciók működnek.</p><Link className={styles.link} href="/admin/clients">Ügyfelek megnyitása</Link></div></section>:<>
   <nav aria-label="Gazdaság kiválasztása" style={{display:"flex",flexWrap:"wrap",gap:8,margin:"15px 0"}}><Link className={styles.link} href="/admin/profit">Összes jogosított</Link>{farms.map(f=><Link className={styles.link} key={f.id} href={`/admin/profit?farm=${f.id}`}>{f.name}</Link>)}</nav>
   <section className={styles.metrics} data-help-block="advisor-profit-summary" aria-label="Pontos pénzügyi mutatók">
    {[{l:"Költségek",v:cost},{l:"Tényleges árbevétel",v:revenue},{l:"Realizált eredmény",v:revenue-cost},{l:"Becsült teljes eredmény",v:projected}].map(m=><article className={styles.metric} key={m.l}><small>{m.l}</small><strong>{money(m.v)}</strong></article>)}
   </section>
   <div data-help-block="advisor-profit-details" style={{display:"grid",gap:14}}>{farms.map(f=><section key={f.id} style={{border:"1px solid #d8e5ed",borderRadius:14,background:"#fff",padding:18}}><h2 style={{color:"#275d83"}}>{f.name}</h2>
    {!f.seasons.length?<p>Még nincs rögzített pénzügyi adat.</p>:f.seasons.map(s=><article key={s.id} style={{padding:14,border:"1px solid #e1e9ed",borderRadius:10,marginBottom:12}}><h3>{s.fieldName} · {s.cropName} · {s.year}</h3><small>{s.areaHa} ha · {tonnes(s.harvestedTonnes)} betakarítva</small><div style={{display:"flex",flexWrap:"wrap",gap:14,color:"#275d83",fontWeight:800,margin:"12px 0"}}><span>Költség: {money(s.totals.totalCost)}</span><span>Árbevétel: {money(s.totals.realizedRevenue)}</span><span>Realizált: {money(s.totals.realizedResult)}</span><span>Becsült: {money(s.totals.projectedResult)}</span></div>
     <details><summary style={{cursor:"pointer",fontWeight:800,color:"#27618b"}}>Költségek és eladási árak ({s.entries.length})</summary><ul>{s.entries.map(e=><li key={e.id}>{e.occurred_on} · {e.entry_type==="cost"?`${e.category}: ${money(e.amount_huf??0)}`:`Terményértékesítés: ${tonnes(e.quantity_tonnes??0)} × ${money(e.price_huf_per_tonne??0)}/t`}</li>)}</ul></details>
    </article>)}
   </section>)}</div>
  </>}
  <p style={{fontSize:11,color:"#667d89",marginTop:18}}>Tervezési kimutatás, nem hivatalos könyvelés. Az áfa, támogatások és közös költségek nem automatikusan kerülnek felosztásra.</p>
 </main>;
}
