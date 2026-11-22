import Link from "next/link";
import styles from "./profitPrivacy.module.css";

const privateMetrics=[
 {label:"Rögzített gazdálkodási költségek",hint:"Kizárólag a gazda saját fiókjában látható"},
 {label:"Tényleges terményárbevétel",hint:"Az eladási árak és mennyiségek bizalmasak"},
 {label:"Realizált eredmény",hint:"Nem jelenítünk meg gazdasági összeget"},
 {label:"Becsült teljes eredmény",hint:"A készlet várható értéke is privát"}
] as const;

/** A deliberately data-free advisor view: no server or browser query to profit tables. */
export default function AdvisorProfitPrivacyPage(){
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI PORTÁL · ADATVÉDELEM</span><h1>Jövedelmezőség</h1><p>A gazdálkodó pénzügyi nyilvántartása elkülönített és bizalmas.</p></div></header>
  <section className={styles.hero} data-help-block="advisor-profit-privacy" aria-labelledby="profit-privacy-title">
   <span className={styles.lock} aria-hidden="true">🔒</span>
   <div><small>GAZDÁLKODÓI PÉNZÜGYI ADATOK</small><h2 id="profit-privacy-title">Az összegek a szaktanácsadó számára rejtettek</h2><p>A költség, terméshozam, tényleges eladási ár és profit a gazdaság tulajdonosának magánadata. Ezen az oldalon ezeknek még a részletes adatait sem kérjük le.</p></div>
  </section>
  <section className={styles.metrics} aria-label="Rejtett pénzügyi mutatók">
   {privateMetrics.map(metric=><article key={metric.label} className={styles.metric}>
    <small>{metric.label}</small><strong aria-label="Bizalmas, rejtett adat">•••••• Ft</strong><span>{metric.hint}</span>
   </article>)}
  </section>
  <section className={styles.notice} data-help-block="advisor-profit-reason"><div className={styles.noticeIcon} aria-hidden="true">i</div><div><h2>Miért nem láthatók a számok?</h2><p>A szaktanácsadó a földtáblákhoz, növényvédelemhez és műveletekhez szükséges szakmai adatokat kezelheti. A gazdálkodó üzleti eredményéhez automatikusan nem kap hozzáférést – a rendszer az adatbázisban is érvényesíti ezt a korlátozást.</p><Link href="/admin/clients" className={styles.link}>Ügyfelek szakmai adatainak megnyitása</Link></div></section>
 </main>;
}
