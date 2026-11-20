import Link from "next/link";
import {redirect} from "next/navigation";
import {AdminNav} from "@/components/AdminNav";
import {FieldBulkImport} from "@/components/FieldBulkImport";
import {createClient} from "@/lib/supabase/server";

/** Separate page so the main overview map remains responsive even for large imports. */
export default async function AdminFieldImportPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")redirect("/dashboard");
  const [{data:farms,error:farmError},{data:fields,error:fieldError}]=await Promise.all([
    supabase.from("farms").select("id,name").order("name"),
    supabase.from("fields").select("id,name,farm_id,boundary_geojson").order("name").limit(10000),
  ]);
  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">DIGITÁLIS TÁBLAHATÁROK</span><h1>Tömeges földtábla-import</h1><p>GeoJSON vagy SHP ZIP állományból egyszerre több földtábla határát rögzítheted.</p></div></header>
    <AdminNav active="field-import"/>
    <p style={{marginBottom:14}}><Link href="/admin/map" className="ghost-btn">← Vissza a földtáblatérképhez</Link></p>
    {farmError||fieldError?<p className="error-box">Nem tölthetők be a gazdaságok és a meglévő táblák. Az import most nem érhető el.</p>:!farms?.length?<section className="panel"><p>Először hozz létre egy gazdaságot az Ügyfelek menüpontban. Utána importálhatod a hozzá tartozó földtáblákat.</p><Link href="/admin/clients">Gazdaságok megnyitása →</Link></section>:<FieldBulkImport farms={farms} existingFields={fields??[]}/>}
  </main>;
}
