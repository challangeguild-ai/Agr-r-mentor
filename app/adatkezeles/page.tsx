import Link from "next/link";
export const metadata={title:"Pénzügyi adatkezelés | Agrár Mentor"};
export default function FinanceDataNotice(){return <main style={{maxWidth:780,margin:"0 auto",padding:"42px 22px 70px",lineHeight:1.7,color:"#294437"}}>
 <Link href="/" style={{color:"#257c50",fontWeight:800}}>← Agrár Mentor</Link><h1>Pénzügyi adatok hozzáférése</h1>
 <p>A Jövedelmezőség modulban a gazdálkodó költségeket, termést, eladási árakat és bevételeket rögzíthet. Ezek bizalmas gazdasági információk.</p>
 <h2>Jogosultak</h2><ul><li>A gazdálkodó kizárólag saját pénzügyi adatait érheti el és szerkesztheti.</li><li>A szaktanácsadó csak névre és gazdaságra szóló, dokumentált felhatalmazás esetén tekinthet meg pontos összegeket; nem szerkesztheti azokat.</li><li>Más gazdálkodó, munkatárs vagy nem jogosított szaktanácsadó nem érheti el a kimutatásokat.</li><li>A rendszeradmin a hozzáférést adhatja és visszavonhatja, de az adminisztrációs felületen nem kap automatikus pénzügyi kimutatást.</li></ul>
 <h2>Naplózás és jogosultságkezelés</h2><p>A szaktanácsadó pénzügyi betekintése és a hozzáférés változtatása naplózott. A jogosultság gazdaságonként visszavonható, és tulajdonosváltás esetén megszűnik. A szaktanácsadói menü nem része a gazdálkodói felületnek.</p>
 <h2>Kérdések és adatkezelési kérelmek</h2><p>Az érintett gazdálkodó a hozzáférésekre vagy adatai kezelésére vonatkozó kérdéssel az Agrár Mentor <Link href="/#kapcsolat">kapcsolatfelvételi csatornájához</Link> fordulhat.</p>
 <p style={{fontSize:12,padding:14,background:"#f0f7f0",borderRadius:10}}>Ez a modul kiegészítő tájékoztatása. A teljes adatkezelési dokumentáció, az adatkezelő azonosítása, a megőrzési idő és a jogalapok véglegesítése külön jogi egyeztetésre vár.</p>
 <small>2026. november 22.</small>
 </main>}
