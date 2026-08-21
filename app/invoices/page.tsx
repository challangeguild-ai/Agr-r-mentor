import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {DocumentLibrary} from "@/components/DocumentLibrary";

export default async function InvoicesPage(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
  if(profile?.role==="advisor")redirect("/admin/documents");
  const{data:documents}=await supabase.from("documents").select("id,title,category,notes,storage_path,file_name,media_type,file_size,created_at,farm_id,field_id,farms(name),fields(name)").eq("category","szamla").order("created_at",{ascending:false});
  return <div className="app-shell farmer-app"><Sidebar active="invoices" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><header className="field-detail-header"><div><span className="eyebrow">PÉNZÜGYI DOKUMENTUMOK</span><h1>Számlák</h1><p>A dokumentumtárba számla kategóriával feltöltött iratok egy helyen.</p></div></header><section className="panel"><DocumentLibrary items={documents??[]}/></section></main></div>
}
