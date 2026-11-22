import Link from "next/link";
import Image from "next/image";
import {LandingLoginModal} from "@/components/LandingLoginModal";
import {AgrarMentorLogo} from "@/components/AgrarMentorLogo";
import {publicContactHref} from "@/lib/publicContact";
import styles from "./landing.module.css";

function BrandMark({large=false}:{large?:boolean}){
  return <span className={large?styles.brandMarkLarge:styles.brandMark} aria-hidden="true">
    <Image src="/images/agrar-wheat-ornament.webp" width={320} height={480} alt="" />
  </span>;
}

const processSteps=[
 ["Gazdaság megismerése","Célok, adottságok, tervek felmérése."],
 ["Területek rögzítése","Táblák, növények, alapadatok felvétele."],
 ["Szemle","Helyszíni állapotfelmérés, problémák azonosítása."],
 ["Javaslat","Konkrét, dokumentált szakmai javaslatok."],
 ["Végrehajtás","Feladatok ütemezése és megvalósítása."],
 ["Ellenőrzés","Eredmények követése, következő lépések."]
] as const;

const dataPoints=[
 ["Helyi időjárási","és csapadékadatok"],
 ["Táblaszintű","információk"],
 ["Korábbi szemlék","és beavatkozások"],
 ["Aktuális","feladatok"],
 ["Visszakövethető","döntések"],
 ["Szezon közbeni","nyomon követés"]
] as const;

export default async function Home({searchParams}:{searchParams:Promise<{login?:string;next?:string}>}){
 const params=await searchParams;const requestedNext=params.next&&params.next.startsWith("/")&&!params.next.startsWith("//")?params.next:null;
 const contactHref=publicContactHref(process.env.AGRAR_CONTACT_EMAIL);
 return <main className={styles.site}>
  <header className={styles.header}>
   <div className={styles.headerInner}>
    <a className={styles.brand} href="#fooldal" aria-label="Agrár Mentor – Főoldal"><AgrarMentorLogo className={styles.brandLogo} onLight priority/></a>
    <nav className={styles.nav} aria-label="Fő navigáció"><a className={styles.active} href="#fooldal">Főoldal</a><a href="#hogyan">Hogyan működik</a><a href="#mobilapp">Android app</a><a href="#digitalis">Digitális háttér</a><a href="#rolunk">Rólunk</a><a href="#kapcsolat">Kapcsolat</a></nav>
    <div className={styles.headerActions}><LandingLoginModal triggerLabel="Belépés" triggerClassName={styles.loginButton} initialOpen={params.login==="1"} next={requestedNext}/><a className={styles.joinButton} href="#kapcsolat">Csatlakozom</a></div>
   </div>
  </header>

  <section className={styles.hero} id="fooldal">
   <div className={styles.heroImage}/>
   <div className={styles.heroWash}/>
   <div className={styles.heroInner}>
    <div className={styles.heroCopy}>
     <h1>Jobb döntések.<br/><em>A földön.</em></h1>
     <p>Személyes agronómiai támogatás, valós területi adatokkal és digitális háttérrel.</p>
     <div className={styles.heroActions}><a className={styles.primaryButton} href="#kapcsolat">Csatlakozom az Agrár Mentorhoz <span>→</span></a><LandingLoginModal triggerLabel="Belépés az ügyfélfelületre" triggerClassName={styles.secondaryButton}/></div>
     <div className={styles.heroAssurances}><span><b aria-hidden="true">✓</b>Helyszíni szemle</span><span><b aria-hidden="true">✓</b>Dokumentált javaslatok</span><span><b aria-hidden="true">✓</b>Digitális ügyfélfelület</span></div>
    </div>
   </div>
   <div className={styles.heroCards} aria-label="Példa gazdasági információk">
    <article><span className={styles.cardIcon}>♧</span><div><small>Déli 12</small><strong>Kukorica · 86 ha</strong><em>● Jó állapot</em></div><i className={styles.fieldThumb}/></article>
    <article><span className={styles.cardIconBlue}>☂</span><div><small>Csapadék (7 nap)</small><strong>28 mm</strong><i className={styles.rainBars}><u/><u/><u/><u/><u/></i></div></article>
    <article><span className={styles.cardIconGold}>▣</span><div><small>Következő szemle</small><strong>Május 20.</strong><em>Felső parcella</em></div></article>
   </div>
  </section>

  <section className={styles.services}>
   <h2>Nem csak tanács. <em>Folyamatos szakmai háttér.</em></h2>
   <div className={styles.serviceGrid}>
    <article><span className={styles.serviceVisualField} aria-hidden="true"/><div><h3>A területen</h3><p>Helyszíni szemle és valós állapotfelmérés.</p></div><b aria-hidden="true">›</b></article>
    <article><span className={styles.serviceVisualAdvisor} aria-hidden="true"/><div><h3>A döntéseknél</h3><p>Konkrét, dokumentált szakmai javaslatok.</p></div><b aria-hidden="true">›</b></article>
    <article><span className={styles.serviceVisualDigital} aria-hidden="true"/><div><h3>A szezon egészében</h3><p>Feladatok, adatok és előzmények egy helyen.</p></div><b aria-hidden="true">›</b></article>
   </div>
  </section>

  <section className={styles.processSection} id="hogyan">
   <h2>Így működik az Agrár Mentor</h2>
   <div className={styles.processGrid}>{processSteps.map(([title,desc],index)=><article key={title} className={styles.processStep}><div className={styles.stepTop}><span className={styles.stepIcon}>{String(index+1).padStart(2,"0")}</span>{index<processSteps.length-1&&<b className={styles.stepArrow}>›</b>}</div><h3>{title}</h3><p>{desc}</p></article>)}</div>
  </section>

  <section className={styles.mobileSection} id="mobilapp" aria-labelledby="mobilapp-title">
   <div className={styles.mobileInner}>
    <div className={styles.mobileVisual}>
     <div className={styles.mobileGlow}/>
     <div className={styles.phoneMockup} aria-label="Az Agrár Mentor Android alkalmazásának szemléltető látványterve" role="img">
      <div className={styles.phoneSpeaker}/>
      <div className={styles.phoneScreen}>
       <div className={styles.phoneStatus}><b>09:41</b><span>●●● ▰</span></div>
       <div className={styles.phoneAppBrand}><AgrarMentorLogo className={styles.phoneAppLogo}/></div>
       <div className={styles.phoneWelcome}><small>AZ ÉN GAZDASÁGOM</small><strong>Jó reggelt!</strong><span>A mai teendők egy helyen.</span></div>
       <div className={styles.phoneHighlight}><small>Aktuális gazdasági állapot</small><strong>3 aktív földtábla</strong><span>Feladatok, napló, szemlék</span></div>
       <div className={styles.phoneCardGrid}><div><b>Tábláim</b><span>Területek</span></div><div><b>Teendők</b><span>Mai feladatok</span></div><div><b>Napló</b><span>Műveletek</span></div><div><b>Szemlék</b><span>Megfigyelések</span></div></div>
       <div className={styles.phoneBottom}><span>Áttekintés</span><span>Táblák</span><span>Feladatok</span><span>Menü</span></div>
      </div>
     </div>
     <p className={styles.phoneCaption}>Szemléltető alkalmazás-látványterv</p>
    </div>
    <div className={styles.mobileCopy}>
     <span className={styles.mobileEyebrow}>AGRÁR MENTOR • ANDROID</span>
     <h2 id="mobilapp-title">A gazdaságod.<br/><em>Veled a terepen is.</em></h2>
     <p>Az Agrár Mentor Android-alkalmazása a webes rendszerhez kapcsolódik. Egyetlen bejelentkezés után a jogosultságodnak megfelelő gazdálkodói, szaktanácsadói vagy adminisztrátori felület fogad.</p>
     <ul className={styles.mobileFeatures}><li>Földtáblák és napi teendők mobilon</li><li>Szemlék, dokumentumok és műveleti napló</li><li>Szerepköralapú, hitelesített hozzáférés</li></ul>
     <div className={styles.mobileRelease}><span className={styles.androidLabel}>ANDROID</span><span className={styles.comingSoon}>Tesztverzió előkészítés alatt</span></div>
     <p className={styles.mobileHonesty}>Az APK még nem tölthető le nyilvánosan. A biztonsági és kiadási ellenőrzések lezárása után tesszük elérhetővé a tesztelőknek.</p>
     <LandingLoginModal triggerLabel="Belépés a webes felületre" triggerClassName={styles.mobileLoginButton}/>
    </div>
   </div>
  </section>

  <section className={styles.digitalSection} id="digitalis">
   <div className={styles.digitalScenery}/>
   <div className={styles.digitalInner}>
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
      <aside className={styles.mockSidebar}><AgrarMentorLogo className={styles.mockBrandLogo}/><span className={styles.mockActive}>⌂ Áttekintés</span><span>⌑ Táblák</span><span>☑ Teendők</span><span>▧ Műveleti napló</span><span>▣ Dokumentumok</span></aside>
      <div className={styles.mockMain}><div className={styles.mockTop}><span>Keresés táblák, feladatok, dokumentumok között…</span><b>●</b></div><h3>Táblák</h3><div className={styles.mockTabs}><b>Térkép nézet</b><span>Lista nézet</span></div><div className={styles.mockWorkspace}><div className={styles.mockMap}><i/><i/><i/><i/><i/></div><div className={styles.mockFieldInfo}><strong>Déli 12</strong><small>86 ha · Kukorica</small><em>● Jó állapot</em><hr/><b>Áttekintés</b><p>Következő feladatok és szakmai állapot egy helyen.</p><ul><li>Következő feladat</li><li>Legutóbbi bejárás</li><li>Megjegyzés</li></ul></div></div></div>
     </div>
     <div className={styles.laptopBase}/>
    </div>
   </div>
  </section>

  <section className={styles.dataBand}>
   <div className={styles.dataInner}>
    <div className={styles.dataCopy}><h2>Több adat. <em>Kevesebb találgatás.</em></h2><p>Valós adatokra és szakmai tapasztalatra alapozott javaslatok, hogy magabiztosabban hozhass döntéseket.</p><div className={styles.dataGrid}>{dataPoints.map(([a,b])=><div key={a}><span aria-hidden="true">✓</span><p>{a}<br/>{b}</p></div>)}</div></div>
    <blockquote><span>“</span>Az adat segít dönteni.<br/><strong>A szakember vállalja<br/>a döntést.</strong><i/></blockquote>
   </div>
  </section>

  <section className={styles.advisorSection} id="rolunk">
   <div className={styles.advisorPhoto} role="img" aria-label="Személyes agrár-szaktanácsadó a területen"/>
   <div className={styles.advisorCopy}><h2>Nem egy call center van a rendszer mögött.</h2><p>Személyes szakmai támogatás, terepi tapasztalattal és folyamatos kapcsolattartással.</p><div className={styles.advisorChips}><span><b>♟</b>Személyes kapcsolat</span><span><b>♧</b>Terepi tapasztalat</span><span><b>▣</b>Digitális háttér</span></div></div>
  </section>

  <section className={styles.contact} id="kapcsolat">
   <div className={styles.contactContour}/>
   <div className={styles.contactInner}><h2>Beszéljünk a gazdaságodról.</h2><p>Nézzük meg együtt, hogyan tud az Agrár Mentor illeszkedni a gazdaságod működéséhez.</p><div>{contactHref?<a className={styles.primaryButton} href={contactHref}>Kapcsolatfelvétel e-mailben <span>→</span></a>:<p role="status">A kapcsolatfelvételi e-mail-cím beállítása folyamatban van. Addig a jelentkezés innen nem küldhető el.</p>}<LandingLoginModal triggerLabel="Már ügyfél vagyok" triggerClassName={styles.secondaryButton}/></div></div>
   <BrandMark large/>
  </section>

  <footer className={styles.footer}>
   <div className={styles.footerInner}><div className={styles.footerBrand}><AgrarMentorLogo className={styles.footerBrandLogo}/></div><nav><a href="#fooldal">Főoldal</a><a href="#hogyan">Hogyan működik</a><a href="#mobilapp">Android app</a><a href="#digitalis">Digitális háttér</a><a href="#rolunk">Rólunk</a><a href="#kapcsolat">Kapcsolat</a><a href="/adatkezeles">Pénzügyi adatkezelés</a></nav><small>© 2026 Agrár Mentor. Minden jog fenntartva.</small></div>
  </footer>
 </main>;
}
