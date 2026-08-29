import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {BlockHelpButton} from "@/components/GuidedTour";
import {DocumentUploadForm} from "@/components/DocumentUploadForm";
import {DocumentLibrary} from "@/components/DocumentLibrary";
import styles from "@/app/documents/documents.module.css";

export default async function AdminDocumentsPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
  const[{data:farms},{data:fields},{data:documents}]=await Promise.all([
    supabase.from("farms").select("id,name").order("name"),
    supabase.from("fields").select("id,name,farm_id").order("name"),
    supabase.from("documents").select("id,title,category,notes,storage_path,file_name,media_type,file_size,created_at,farm_id,field_id,farms(name),fields(name)").order("created_at",{ascending:false})
  ]);
  const docs=documents??[];const invoices=docs.filter(d=>d.category==="szamla").length;const soil=docs.filter(d=>d.category==="talajvizsgalat").length;const totalSize=docs.reduce((s,d)=>s+Number(d.file_size||0),0);
  return <main className={`admin-shell ${styles.page}`}>
    <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI IRATTÁR</span><h1>Dokumentumok</h1><p>Ügyfelekhez, gazdaságokhoz és földtáblákhoz tartozó iratok egy központi helyen.</p></div><Link href="/admin/backup" className="btn btn-secondary">Biztonsági mentés</Link></header>
    <AdminNav active="documents"/>
    <section className="admin-overview-grid" data-help-block="advisor-doc-summary"><div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end"}}><BlockHelpButton label="A dokumentum-összesítő magyarázata" content={{title:"Dokumentumtár összesítő",body:"Ez a blokk megmutatja a központi irattár teljes dokumentumszámát, külön a Számla és Talajvizsgálat kategóriába sorolt iratok számát, valamint a feltöltött fájlok összes tárhelyigényét megabájtban.",important:"Az összesítő a dokumentumok kategorizálásából számol. Ha egy irat rossz kategóriába került, a célzott nézetek és ezek a számlálók is pontatlanok lehetnek."}}/></div><article className="admin-overview-card"><span>Összes dokumentum</span><strong>{docs.length}</strong><small>Központi irattár</small></article><article className="admin-overview-card"><span>Számlák</span><strong>{invoices}</strong><small>Pénzügyi dokumentum</small></article><article className="admin-overview-card"><span>Talajvizsgálatok</span><strong>{soil}</strong><small>Szakmai dokumentum</small></article><article className="admin-overview-card"><span>Tárhely</span><strong>{(totalSize/1048576).toLocaleString("hu-HU",{maximumFractionDigits:1})}</strong><small>MB feltöltött fájl</small></article></section>
    <section className={styles.card} data-help-block="advisor-doc-upload"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><span className="eyebrow">ÚJ DOKUMENTUM FELTÖLTÉSE</span><BlockHelpButton label="A dokumentumfeltöltés magyarázata" content={{title:"Új ügyféldokumentum feltöltése",body:"Ebben a blokkban új iratot töltesz fel a szaktanácsadói központi dokumentumtárba. A fájl mellett meg kell adni a címet, kategóriát és azt a gazdaságot vagy földtáblát, amelyhez az irat szakmailag tartozik.",important:"A gazdaság- és táblakapcsolat határozza meg, melyik ügyfél szakmai dossziéjában jelenik meg az irat. A kategória pedig a célzott visszakeresést – például a számla- vagy talajvizsgálati nézetet – befolyásolja.",example:"Példa: egy talajvizsgálati eredménynél válaszd ki a megfelelő gazdaságot és földtáblát, majd a Talajvizsgálat kategóriát.",steps:["Adj egyértelmű címet az iratnak.","Válaszd ki a megfelelő kategóriát.","Rendeld a megfelelő gazdasághoz és szükség esetén földtáblához.","Töltsd fel a fájlt.","Mentés után ellenőrizd a Dokumentumtár listában a hozzárendelést."]}}/></div><DocumentUploadForm farms={farms??[]} fields={fields??[]}/></section>
    <section className={styles.card} data-help-block="advisor-doc-library"><div className={styles.libraryHead}><div><span className="eyebrow">DOKUMENTUMTÁR</span><h2>Feltöltött dokumentumok</h2></div><div style={{display:"flex",alignItems:"center",gap:10}}><div className={styles.count}><strong>{docs.length}</strong><span>dokumentum</span></div><BlockHelpButton label="A feltöltött dokumentumok listájának magyarázata" content={{title:"Feltöltött dokumentumok",body:"A lista a központi irattárban lévő dokumentumokat mutatja a cím, kategória, fájladatok és gazdaság- vagy földtábla-hozzárendelés alapján. Innen ellenőrizhető, hogy egy irat a megfelelő ügyfélhez és szakmai egységhez került-e.",important:"Ha egy dokumentum nem jelenik meg egy célzott modulban, először a kategóriáját és a gazdaság-/tábla-hozzárendelését ellenőrizd. A biztonsági mentés a dokumentumok metaadatait tartalmazza; a tényleges fájlok a tárhelyen maradnak."}}/></div></div><DocumentLibrary items={docs}/></section>
  </main>;
}
