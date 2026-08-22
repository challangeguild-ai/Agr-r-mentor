import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {FieldMapEditor} from "@/components/FieldMapEditor";

type SP=Promise<{field?:string}>;

export default async function AdminMapPage({searchParams}:{searchParams:SP}){
  const{field:fieldId}=await searchParams;
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
  const[{data:fields},{data:farms}]=await Promise.all([
    supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,center_lat,center_lng,boundary_geojson,boundary_updated_at").order("name"),
    supabase.from("farms").select("id,name,owner_id").order("name")
  ]);
  const selected=(fields??[]).find(f=>f.id===fieldId)||(fields??[])[0]||null;
  const mapped=(fields??[]).filter(f=>f.center_lat!=null&&f.center_lng!=null).length;
  const bounded=(fields??[]).filter(f=>f.boundary_geojson).length;
  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">TÉRKÉPI NYILVÁNTARTÁS</span><h1>Földtáblák térképen</h1><p>Földtáblák helyének és tényleges táblahatárának rögzítése.</p></div></header>
    <AdminNav active="map"/>
    <section className="admin-overview-grid">
      <article className="admin-overview-card"><span>Összes földtábla</span><strong>{fields?.length??0}</strong><small>nyilvántartott tábla</small></article>
      <article className="admin-overview-card"><span>Térképen elhelyezve</span><strong>{mapped}</strong><small>középponttal</small></article>
      <article className="admin-overview-card"><span>Táblahatárral</span><strong>{bounded}</strong><small>GeoJSON poligonnal</small></article>
      <article className="admin-overview-card"><span>Hiányzó térkép</span><strong>{Math.max(0,(fields?.length??0)-mapped)}</strong><small>még beállítandó</small></article>
    </section>
    <section className="panel" style={{marginBottom:14}}><div className="panel-heading"><div><span className="eyebrow">FÖLDTÁBLA KIVÁLASZTÁSA</span><h2>Térképi adat szerkesztése</h2></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>{(fields??[]).map(f=>{const farm=farms?.find(x=>x.id===f.farm_id);return <Link key={f.id} href={`/admin/map?field=${f.id}`} className={`field-card ${selected?.id===f.id?"active":""}`} style={{border:selected?.id===f.id?"2px solid #39752f":"1px solid #e1e5df"}}><strong>{f.name}</strong><small style={{display:"block",marginTop:4,color:"#6f7c74"}}>{farm?.name||"Gazdaság"} · {f.area_ha?`${f.area_ha} ha`:"—"} · {f.current_crop||"Nincs kultúra"}</small><small style={{display:"block",marginTop:7,color:f.boundary_geojson?"#39752f":"#9a7b2d"}}>{f.boundary_geojson?"✓ Táblahatár rögzítve":f.center_lat!=null?"• Középpont rögzítve":"○ Nincs térképi adat"}</small></Link>})}</div></section>
    {selected?<><FieldMapEditor fieldId={selected.id} lat={selected.center_lat} lng={selected.center_lng} boundary={selected.boundary_geojson} editable={true}/><div style={{marginTop:12}}><Link className="ghost-btn" href={`/fields/${selected.id}`}>Földtábla teljes adatlapja →</Link></div></>:<section className="panel"><div className="empty-state">Még nincs földtábla, amit térképen meg lehetne jeleníteni.</div></section>}
  </main>
}
