import Link from "next/link";
import styles from "./landing.module.css";

function BrandMark(){
  return <span className={styles.brandMark} aria-hidden="true">
    <svg viewBox="0 0 42 54" role="img">
      <path d="M21 51V8" />
      <path d="M21 17C14 14 10 10 9 5c7 1 11 5 12 12Z" />
      <path d="M21 25c7-3 11-7 12-12-7 1-11 5-12 12Z" />
      <path d="M21 32c-7-3-11-7-12-12 7 1 11 5 12 12Z" />
      <path d="M21 40c7-3 11-7 12-12-7 1-11 5-12 12Z" />
      <path d="M21 47c-7-3-11-7-12-12 7 1 11 5 12 12Z" />
    </svg>
  </span>;
}

const process = [
  ["1","Gazdaság megismerése","Célok, adottságok, tervek felmérése.","♟"],
  ["2","Területek rögzítése","Táblák, növények, alapadatok felvétele.","⌑"],
  ["3","Szemle","Helyszíni állapotfelmérés, problémák azonosítása.","◒"],
  ["4","Javaslat","Konkrét, dokumentált szakmai javaslatok.","▤"],
  ["5","Végrehajtás","Feladatok ütemezése és megvalósítása.","✿"],
  ["6","Ellenőrzés","Eredmények követése, következő lépések.","✓"]
] as const;

const dataPoints = [
  ["☁","Helyi időjárási","és csapadékadatok"],
  ["⌑","Táblaszintű","információk"],
  ["◴","Korábbi szemlék","és beavatkozások"],
  ["☷","Aktuális","feladatok"],
  ["⌁","Visszakövethető","döntések"],
  ["◒","Szezon közbeni","nyomon követés"]
] as const;

export default function Home(){
  return <main className={styles.site}>
    <header className={styles.header}>
      <a className={styles.brand} href="#fooldal" aria-label="Agrár Mentor – Főoldal">
        <BrandMark/>
        <span><strong>AGRÁR MENTOR</strong><small>TUDÁS. TERV. EREDMÉNY.</small></span>
      </a>
      <nav className={styles.nav} aria-label="Fő navigáció">
        <a className={styles.active} href="#fooldal">Főoldal</a>
        <a href="#hogyan">Hogyan működik</a>
        <a href="#digitalis">Digitális háttér</a>
        <a href="#rolunk">Rólunk</a>
        <a href="#kapcsolat">Kapcsolat</a>
      </nav>
      <div className={styles.headerActions}>
        <Link className={styles.loginButton} href="/login">Belépés</Link>
        <a className={styles.joinButton} href="#kapcsolat">Csatlakozom</a>
      </div>
    </header>

    <section className={styles.hero} id="fooldal">
      <div className={styles.heroCopy}>
        <h1>Jobb döntések.<br/><em>A földön.</em></h1>
        <p>Személyes agronómiai támogatás, valós területi adatokkal és digitális háttérrel.</p>
        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href="#kapcsolat">Csatlakozom az Agrár Mentorhoz <span>→</span></a>
          <Link className={styles.secondaryButton} href="/login">Belépés az ügyfélfelületre</Link>
        </div>
        <div className={styles.heroAssurances}>
          <span><b>♧</b> Helyszíni szemle</span>
          <span><b>▤</b> Dokumentált javaslatok</span>
          <span><b>▣</b> Digitális ügyfélfelület</span>
        </div>
      </div>

      <div className={styles.heroScene} aria-label="Agrár Mentor terepi szaktanácsadás">
        <div className={styles.sceneShade}/>
        <div className={styles.floatingCard+" "+styles.fieldCard}>
          <span className={styles.cardIcon}>♧</span>
          <div><small>Déli 12</small><b>Kukorica · 86 ha</b><em>● Jó állapot</em></div>
        </div>
        <div className={styles.floatingCard+" "+styles.rainCard}>
          <span className={styles.cardIcon}>☂</span>
          <div><small>Csapadék (7 nap)</small><b>28 mm</b><i className={styles.miniBars}><u/><u/><u/><u/><u/></i></div>
        </div>
        <div className={styles.floatingCard+" "+styles.visitCard}>
          <span className={styles.cardIcon}>▣</span>
          <div><small>Következő szemle</small><b>Május 20.</b><em>Felső parcella</em></div>
        </div>
      </div>
    </section>

    <section className={styles.services}>
      <h2>Nem csak tanács. <em>Folyamatos szakmai háttér.</em></h2>
      <div className={styles.serviceGrid}>
        <article><span className={styles.serviceIcon}>♧</span><div><h3>A területen</h3><p>Helyszíni szemle és valós állapotfelmérés.</p></div><b>›</b></article>
        <article><span className={styles.serviceIcon+" "+styles.goldIcon}>▤</span><div><h3>A döntéseknél</h3><p>Konkrét, dokumentált szakmai javaslatok.</p></div><b>›</b></article>
        <article><span className={styles.serviceIcon}>▥</span><div><h3>A szezon egészében</h3><p>Feladatok, adatok és előzmények egy helyen.</p></div><b>›</b></article>
      </div>
    </section>

    <section className={styles.processSection} id="hogyan">
      <h2>Így működik az Agrár Mentor</h2>
      <div className={styles.processGrid}>
        {process.map(([n,title,desc,icon],index)=><article key={n} className={styles.processStep}>
          <div className={styles.stepTop}>
            <span className={styles.stepNumber}>{n}</span>
            <span className={styles.stepIcon}>{icon}</span>
            {index<process.length-1&&<b className={styles.stepArrow}>›</b>}
          </div>
          <h3>{title}</h3><p>{desc}</p>
        </article>)}
      </div>
    </section>

    <section className={styles.digitalSection} id="digitalis">
      <div className={styles.digitalCopy}>
        <h2>A gazdaságod nem<br/>egy Excel-tábla.</h2>
        <p>Az Agrár Mentor ügyfélfelületén egy helyen követheted a tábláidat, feladataidat, szemléidet, dokumentumaidat és a szakmai javaslatokat.</p>
        <div className={styles.featureTiles}>
          <div><span>⌑</span><p><b>Táblák</b><small>Áttekinthető területadatok</small></p></div>
          <div><span>▤</span><p><b>Teendők</b><small>Feladatok és határidők</small></p></div>
          <div><span>▧</span><p><b>Műveleti napló</b><small>Elvégzett beavatkozások</small></p></div>
          <div><span>▣</span><p><b>Dokumentumok</b><small>Szakmai anyagok, leírások</small></p></div>
        </div>
      </div>

      <div className={styles.laptop} aria-label="Agrár Mentor digitális ügyfélfelület előnézete">
        <div className={styles.laptopScreen}>
          <aside className={styles.mockSidebar}>
            <strong>AGRÁR MENTOR</strong>
            <span className={styles.mockActive}>⌂ Áttekintés</span>
            <span>⌑ Táblák</span><span>☑ Teendők</span><span>▧ Műveleti napló</span><span>▣ Dokumentumok</span>
          </aside>
          <div className={styles.mockMain}>
            <div className={styles.mockTop}><span>Keresés táblák, feladatok, dokumentumok között…</span><b>●</b></div>
            <h3>Táblák</h3>
            <div className={styles.mockTabs}><b>Térkép nézet</b><span>Lista nézet</span></div>
            <div className={styles.mockWorkspace}>
              <div className={styles.mockMap}><i/><i/><i/><i/></div>
              <div className={styles.mockFieldInfo}>
                <strong>Déli 12</strong><small>86 ha · Kukorica</small><em>● Jó állapot</em><hr/>
                <b>Áttekintés</b><p>Következő feladatok és szakmai állapot egy helyen.</p>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.laptopBase}/>
      </div>
    </section>

    <section className={styles.dataBand}>
      <div className={styles.dataInner}>
        <div className={styles.dataCopy}>
          <h2>Több adat. <em>Kevesebb találgatás.</em></h2>
          <p>Valós adatokra és szakmai tapasztalatra alapozott javaslatok, hogy magabiztosabban hozhass döntéseket.</p>
          <div className={styles.dataGrid}>
            {dataPoints.map(([icon,a,b])=><div key={a}><span>{icon}</span><p>{a}<br/>{b}</p></div>)}
          </div>
        </div>
        <blockquote><span>“</span>Az adat segít dönteni.<br/><strong>A szakember vállalja<br/>a döntést.</strong><i/></blockquote>
      </div>
    </section>

    <section className={styles.advisorSection} id="rolunk">
      <div className={styles.advisorPhoto} role="img" aria-label="Személyes agrár-szaktanácsadó a területen"/>
      <div className={styles.advisorCopy}>
        <h2>Nem egy call center van a rendszer mögött.</h2>
        <p>Személyes szakmai támogatás, terepi tapasztalattal és folyamatos kapcsolattartással.</p>
        <div className={styles.advisorChips}>
          <span><b>♟</b> Személyes kapcsolat</span>
          <span><b>♧</b> Terepi tapasztalat</span>
          <span><b>▣</b> Digitális háttér</span>
        </div>
      </div>
    </section>

    <section className={styles.contact} id="kapcsolat">
      <div className={styles.contactLines}/>
      <div className={styles.contactInner}>
        <h2>Beszéljünk a gazdaságodról.</h2>
        <p>Nézzük meg együtt, hogyan tud az Agrár Mentor illeszkedni a gazdaságod működéséhez.</p>
        <div>
          <a className={styles.primaryButton} href="#kapcsolat">Kapcsolatfelvétel <span>→</span></a>
          <Link className={styles.secondaryButton} href="/login">Már ügyfél vagyok</Link>
        </div>
      </div>
      <BrandMark/>
    </section>

    <footer className={styles.footer}>
      <div className={styles.footerBrand}><BrandMark/><span><strong>AGRÁR MENTOR</strong><small>TUDÁS. TERV. EREDMÉNY.</small></span></div>
      <nav>
        <a href="#fooldal">Főoldal</a><a href="#hogyan">Hogyan működik</a><a href="#digitalis">Digitális háttér</a><a href="#rolunk">Rólunk</a><a href="#kapcsolat">Kapcsolat</a>
      </nav>
      <small>© 2026 Agrár Mentor. Minden jog fenntartva.</small>
    </footer>
  </main>;
}
