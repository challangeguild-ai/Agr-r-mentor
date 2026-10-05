import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {BlockHelpButton} from "@/components/GuidedTour";
import {DocumentUploadForm} from "@/components/DocumentUploadForm";
import {DocumentLibrary} from "@/components/DocumentLibrary";
import styles from "./documents.module.css";

export default async function DocumentsPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin/documents");

 const{data:farms}=await supabase.from("farms").select("id,name").eq("owner_id",user.id).order("name");
 const farmIds=(farms??[]).map(f=>f.id);
 const{data:fields}=farmIds.length?await supabase.from("fields").select("id,name,farm_id").in("farm_id",farmIds).order("name"):{data:[]};
 const fieldIds=(fields??[]).map(f=>f.id);
 let documents:any[]=[];
 if(farmIds.length||fieldIds.length){
  let q=supabase.from("documents").select("id,title,category,notes,storage_path,file_name,media_type,file_size,created_at,farm_id,field_id,farms(name),fields(name)").order("created_at",{ascending:false});
  if(farmIds.length&&fieldIds.length)q=q.or(`farm_id.in.(${farmIds.join(",")}),field_id.in.(${fieldIds.join(",")})`);
  else if(farmIds.length)q=q.in("farm_id",farmIds);else q=q.in("field_id",fieldIds);
  const{data}=await q;documents=data??[];
 }

 return <div className="app-shell farmer-app">
  <Sidebar active="documents" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés dokumentumok, fájlok vagy táblák között…"/>
   <section className={styles.titleRow}>
    <div><h1>Dokumentumok</h1><p>Tárold és kezeld a fontos dokumentumokat egy helyen.</p></div>
    <BlockHelpButton label="A dokumentumtár magyarázata" content={{title:"Dokumentumtár",body:"A dokumentumok gazdasághoz vagy földtáblához kapcsolva kereshetők vissza. A szűrők és a kereső gyorsan szűkítik a listát.",important:"A pontos kategória és hozzárendelés segíti a későbbi visszakeresést."}}/>
   </section>

   <details className={styles.uploadDisclosure}>
    <summary>+ Feltöltés</summary>
    <div className={styles.uploadCard}><div className={styles.uploadHead}><div><span>ÚJ DOKUMENTUM</span><h2>Dokumentum feltöltése</h2></div></div><DocumentUploadForm farms={farms??[]} fields={fields??[]}/></div>
   </details>

   <section className={styles.libraryCard}>
    <div className={styles.libraryHead}><div><h2>Dokumentumtár</h2><p>{documents.length} dokumentum</p></div></div>
    <DocumentLibrary items={documents}/>
   </section>
  </main>
 </div>;
}
