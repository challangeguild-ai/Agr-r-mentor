import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {BlockHelpButton} from "@/components/GuidedTour";

export default async function BackupPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">BIZTONSÁGI MENTÉS</span><h1>Kézi adatmentés</h1><p>Letölthető biztonsági másolat a szakmai adatokról.</p></div></header>
  <AdminNav active="documents"/>
  <section className="panel" style={{padding:22,maxWidth:920}} data-help-block="backup">
   <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><h2 style={{marginTop:0}}>Teljes adatbázis-mentés</h2></div><BlockHelpButton label="A biztonsági mentés magyarázata" content={{title:"Kézi biztonsági mentés",body:"Innen letölthető egy export a rendszer szakmai adatbázisáról. A mentés az ügyfél-, gazdaság-, földtábla-, szemle-, teendő-, bejelentés-, idővonal-, dokumentum-metaadat-, munkatárs-, gép- és értesítési adatokat tartalmazza.",important:"A letöltés nem tartalmaz jelszavakat vagy titkos API-kulcsokat. A feltöltött dokumentumok és fényképek tényleges fájljai sincsenek benne; csak a hozzájuk tartozó metaadatok. A fájlokat külön a Supabase tárhely őrzi.",example:"Példa: nagyobb katalógusfrissítés vagy több ügyféladat módosítása előtt letöltesz egy kézi mentést, majd a fájlt dátummal ellátva külön biztonságos helyen tárolod.",steps:["Nagyobb adatváltoztatás előtt nyisd meg ezt az oldalt.","Olvasd át, mit tartalmaz és mit nem tartalmaz az export.","Nyomd meg a Biztonsági mentés letöltése gombot.","Ellenőrizd, hogy a fájl valóban letöltődött.","Tárold elkülönített, hozzáférés-védett helyen.","A feltöltött fájlok külön mentéséről szükség esetén a tárhelyszinten kell gondoskodni."]}}/></div>
   <p style={{color:"#6f7c74",lineHeight:1.6}}>A mentés tartalmazza az ügyfeleket, gazdaságokat, földtáblákat, szemléket, feladatokat, bejelentéseket, idővonalat, dokumentum-metaadatokat, munkatársakat, gépeket és értesítéseket. Jelszavakat és titkos API-kulcsokat nem tartalmaz.</p>
   <p style={{color:"#6f7c74",lineHeight:1.6}}>A feltöltött dokumentumok és fotók listája bekerül a mentésbe, de maguk a fájlok nem. Ezek továbbra is a Supabase tárhelyen maradnak.</p>
   <a href="/admin/backup/export" className="btn btn-primary" download>Biztonsági mentés letöltése</a>
   <div style={{marginTop:18,padding:14,border:"1px solid #ead79f",background:"#fffaf0",borderRadius:12}}><strong>Javaslat</strong><p style={{margin:"7px 0 0",color:"#6f7c74"}}>Készíts mentést nagyobb törlés, tesztelési kör vagy fontos adatfeltöltés előtt, és őrizd meg külön eszközön is.</p></div>
  </section>
  <div style={{marginTop:12}}><Link href="/admin/documents" className="ghost-btn">← Vissza a dokumentumokhoz</Link></div>
 </main>;
}
