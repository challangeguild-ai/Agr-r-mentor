import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {DocumentLibrary} from "@/components/DocumentLibrary";
import {BlockHelpButton} from "@/components/GuidedTour";

export default async function InvoicesPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("full_name,role,system_role").eq("id",user.id).maybeSingle();
  if(profile?.system_role==="admin")redirect("/system-admin");
  if(profile?.role==="advisor")redirect("/admin/documents");
  const{data:farms}=await supabase.from("farms").select("id").eq("owner_id",user.id);
  const farmIds=(farms??[]).map(f=>f.id);
  const{data:documents,error}=farmIds.length?await supabase.from("documents").select("id,title,category,notes,storage_path,file_name,media_type,file_size,created_at,farm_id,field_id,farms(name),fields(name)").eq("category","szamla").in("farm_id",farmIds).order("created_at",{ascending:false}):{data:[],error:null};
  if(error)throw new Error(error.message);
  const items=documents??[];
  const totalSize=items.reduce((s,d)=>s+Number(d.file_size||0),0);
  const thisYear=items.filter(d=>new Date(d.created_at).getFullYear()===new Date().getFullYear()).length;
  return <div className="app-shell farmer-app"><Sidebar active="invoices" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><header className="field-detail-header"><div><span className="eyebrow">PÉNZÜGYI DOKUMENTUMOK</span><h1>Számlák</h1><p>A dokumentumtárba számla kategóriával feltöltött iratok egy helyen.</p></div></header><section className="stats-grid"><article className="stat-card"><span>Összes számla</span><strong>{items.length}</strong><small>Feltöltött dokumentum</small></article><article className="stat-card"><span>Idei számlák</span><strong>{thisYear}</strong><small>{new Date().getFullYear()}. év</small></article><article className="stat-card"><span>Tárhely</span><strong>{totalSize?`${(totalSize/1048576).toLocaleString("hu-HU",{maximumFractionDigits:1})} MB`:"0 MB"}</strong><small>Számlafájlok mérete</small></article><article className="stat-card"><span>Gazdaságok</span><strong>{farmIds.length}</strong><small>Saját gazdaság</small></article></section><section className="panel" data-help-block="invoices"><div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><BlockHelpButton label="A számlatár használatának magyarázata" content={{title:"Számlák és pénzügyi dokumentumok",body:"Ez a nézet automatikusan összegyűjti azokat a dokumentumokat, amelyeket a Dokumentumok modulban Számla kategóriával töltöttél fel. Így nem kell külön pénzügyi fájlkezelést fenntartanod.",important:"A számlák itt csak akkor jelennek meg, ha feltöltéskor a Számla kategóriát választottad és a dokumentum a saját gazdaságodhoz kapcsolódik. A felület dokumentumtár, nem könyvelési vagy adóbevallási rendszer.",example:"Példa: egy növényvédőszer-vásárlás számláját feltöltöd a Dokumentumok között Számla kategóriával és a megfelelő gazdasághoz rendeled. Ezután ezen az oldalon automatikusan megjelenik az idei számlák között.",steps:["A dokumentum feltöltésekor válaszd a Számla kategóriát.","Kapcsold a megfelelő gazdasághoz vagy szükség esetén földtáblához.","A Számlák oldalon ellenőrizd az összes és az idei számlák számát.","A dokumentumlistából nyisd meg a szükséges számlát.","Ha egy számla hiányzik, ellenőrizd a Dokumentumok modulban a kategóriáját és gazdasági hozzárendelését."]}}/></div><DocumentLibrary items={items}/></section></main></div>
}