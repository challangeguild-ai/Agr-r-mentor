import Link from "next/link";
import {BlockHelpButton} from "@/components/GuidedTour";
import {SensitiveExportButton} from "@/components/SensitiveExportButton";
import styles from "./backup.module.css";

export default function SystemAdminBackupPage(){
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">BIZTONSÁGI MENTÉS</span><h1>Kézi adatmentés</h1><p>Rendszeradminisztrátori, friss hitelesítéssel védett teljes szakmai adatmentés.</p></div></header>
  <section className={`panel ${styles.backupPanel}`} data-help-block="backup">
   <div className={styles.panelHeading}><h2>Teljes adatbázis-mentés</h2><BlockHelpButton label="A biztonsági mentés magyarázata" content={{title:"Kézi biztonsági mentés",body:"Innen letölthető a rendszer szakmai adatbázisának exportja.",important:"A teljes export kiemelten védett rendszeradminisztrátori művelet. A normál kétfaktoros belépésen felül minden letöltés előtt új authenticator-kódot kérünk.",steps:["Nyomd meg a Biztonsági mentés letöltése gombot.","Írd be az authenticator alkalmazás aktuális 6 jegyű kódját.","Sikeres ellenőrzés után indul a letöltés.","Tárold a fájlt elkülönített, hozzáférés-védett helyen."]}}/></div>
   <p className={styles.description}>A mentés tartalmazza a profilokat, gazdaságokat, földtáblákat, szemléket, feladatokat, bejelentéseket, idővonalat, dokumentum-metaadatokat, munkatársakat, gépeket és értesítéseket. Jelszavakat és titkos API-kulcsokat nem tartalmaz.</p>
   <p className={styles.description}>A feltöltött dokumentumok és fotók listája bekerül a mentésbe, de maguk a fájlok nem; azok a Supabase tárhelyen maradnak.</p>
   <div className={styles.securityNotice}><strong>🔐 Friss hitelesítés szükséges</strong><p>Minden export előtt új authenticator-kód szükséges, a megerősítés rövid ideig érvényes.</p></div>
   <SensitiveExportButton/>
  </section>
  <div style={{marginTop:12}}><Link href="/system-admin" className="ghost-btn">← Vissza a rendszeráttekintéshez</Link></div>
 </main>;
}
