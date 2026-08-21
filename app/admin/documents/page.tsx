import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
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
  return <main className={`admin-shell ${styles.page}`}>
    <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI IRATTÁR</span><h1>Dokumentumok</h1><p>Ügyfelekhez, gazdaságokhoz és földtáblákhoz tartozó iratok egy központi helyen.</p></div></header>
    <section className={styles.card}><span className="eyebrow">ÚJ DOKUMENTUM FELTÖLTÉSE</span><DocumentUploadForm farms={farms??[]} fields={fields??[]}/></section>
    <section className={styles.card}><div className={styles.libraryHead}><div><span className="eyebrow">DOKUMENTUMTÁR</span><h2>Feltöltött dokumentumok</h2></div><div className={styles.count}><strong>{documents?.length??0}</strong><span>dokumentum</span></div></div><DocumentLibrary items={documents??[]}/></section>
  </main>;
}
