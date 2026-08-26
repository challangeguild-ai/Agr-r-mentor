import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {BlockHelpButton} from "@/components/GuidedTour";
import {SensitiveExportButton} from "@/components/SensitiveExportButton";

export default async function BackupPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")redirect("/mfa?next=/admin/backup");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">BIZTONSÁGI MENTÉS</span><h1>Kézi adatmentés</h1><p>Letölthető biztonsági másolat a szakmai adatokról.</p></div></header>
  <AdminNav active="documents"/>
  <section className="panel" style={{padding:22,maxWidth:920}} data-help-block="backup">
   <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><h2 style={{marginTop:0}}>Teljes adatbázis-mentés</h2></div><BlockHelpButton label="A biztonsági mentés magyarázata" content={{title:"Kézi biztonsági mentés",body:"Innen letölthető egy export a rendszer szakmai adatbázisáról. A mentés az ügyfél-, gazdaság-, földtábla-, szemle-, teendő-, bejelentés-, idővonal-, dokumentum-metaadat-, munkatárs-, gép- és értesítési adatokat tartalmazza.",important:"A teljes export kiemelten védett művelet. A normál kétfaktoros belépésen felül minden letöltés előtt új, 6 jegyű authenticator-kódot kérünk. A friss megerősítés csak rövid ideig, 5 percig használható.",example:"Példa: nagyobb katalógusfrissítés előtt mentést készítesz. A letöltés gomb után az authenticator alkalmazás aktuális kódját is meg kell adnod, és csak ezután indul el a fájl.",steps:["Nyisd meg ezt az oldalt.","Nyomd meg a Biztonsági mentés letöltése gombot.","Írd be az authenticator alkalmazás aktuális 6 jegyű kódját.","Sikeres ellenőrzés után indul a letöltés.","Ellenőrizd, hogy a fájl valóban letöltődött.","Tárold elkülönített, hozzáférés-védett helyen."]}}/></div>
   <p style={{color:"#6f7c74",lineHeight:1.6}}>A mentés tartalmazza az ügyfeleket, gazdaságokat, földtáblákat, szemléket, feladatokat, bejelentéseket, idővonalat, dokumentum-metaadatokat, munkatársakat, gépeket és értesítéseket. Jelszavakat és titkos API-kulcsokat nem tartalmaz.</p>
   <p style={{color:"#6f7c74",lineHeight:1.6}}>A feltöltött dokumentumok és fotók listája bekerül a mentésbe, de maguk a fájlok nem. Ezek továbbra is a Supabase tárhelyen maradnak.</p>
   <div style={{padding:14,border:"1px solid #cfe0d4",background:"#f3f8f4",borderRadius:12,marginBottom:16}}><strong>🔐 Friss hitelesítés szükséges</strong><p style={{margin:"7px 0 0",color:"#5f7166"}}>A már hitelesített munkamenet önmagában nem elég a teljes exporthoz. Minden export előtt új authenticator-kódot kérünk.</p></div>
   <SensitiveExportButton/>
   <div style={{marginTop:18,padding:14,border:"1px solid #ead79f",background:"#fffaf0",borderRadius:12}}><strong>Javaslat</strong><p style={{margin:"7px 0 0",color:"#6f7c74"}}>Készíts mentést nagyobb törlés, tesztelési kör vagy fontos adatfeltöltés előtt, és őrizd meg külön eszközön is.</p></div>
  </section>
  <div style={{marginTop:12}}><Link href="/admin/documents" className="ghost-btn">← Vissza a dokumentumokhoz</Link></div>
 </main>;
}
