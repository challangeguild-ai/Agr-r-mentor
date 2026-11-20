import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";

export default async function BoundaryProposalQueue({searchParams}:{searchParams:Promise<{result?:string;error?:string}>}){
  const {result,error:queryError}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor"||profile?.system_role==="admin")redirect("/dashboard");

  const {data:proposals,error}=await supabase.from("field_boundary_proposals")
    .select("id,field_id,farm_id,created_at,geometry_source,has_boundary,note")
    .eq("status","pending").order("created_at",{ascending:true}).limit(200);
  const fieldIds=(proposals??[]).map(p=>p.field_id);
  const farmIds=[...new Set((proposals??[]).map(p=>p.farm_id))];
  const [{data:fields},{data:farms}]=await Promise.all([
    fieldIds.length?supabase.from("fields").select("id,name,area_ha").in("id",fieldIds):Promise.resolve({data:[]}),
    farmIds.length?supabase.from("farms").select("id,name").in("id",farmIds):Promise.resolve({data:[]})
  ]);
  const fieldById=new Map((fields??[]).map(f=>[f.id,f]));
  const farmById=new Map((farms??[]).map(f=>[f.id,f.name]));

  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">GAZDÁLKODÓI KÉRELMEK</span><h1>Táblahatár-javaslatok</h1><p>A gazdák által megjelölt helypontok és poligonok csak ellenőrzés után kerülhetnek át a nyilvántartásba.</p></div></header>
    <AdminNav active="map-proposals"/>
    {result==="approved"&&<p role="status" className="panel" style={{color:"#2f7430"}}>A javaslatot jóváhagytad; a földtábla térképe frissült.</p>}
    {result==="rejected"&&<p role="status" className="panel" style={{color:"#996027"}}>A javaslatot elutasítottad. A táblahatár változatlan maradt.</p>}
    {queryError&&<p role="alert" className="panel" style={{color:"#b3342b"}}>{queryError.slice(0,400)}</p>}
    {error?<section className="panel"><h2>A javaslatlista még nem elérhető</h2><p>Valószínűleg a táblahatár-javaslatok adatbázis-migrációja még nincs alkalmazva. Az éles adatbázis változatlan maradt.</p></section>:
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ELBÍRÁLÁSRA VÁR</span><h2>{proposals?.length??0} táblahatár-javaslat</h2></div><Link className="ghost-btn" href="/admin/map">Térképi nyilvántartás →</Link></div>
        {(proposals??[]).length===0?<p className="empty-state">Nincs elbírálásra váró határjavaslat.</p>:<div className="task-list" style={{marginTop:14}}>{(proposals??[]).map(proposal=><div key={proposal.id} className="task-row" style={{gap:12,flexWrap:"wrap"}}><span className="dot normal"/><div style={{flex:1,minWidth:180}}><strong>{fieldById.get(proposal.field_id)?.name||"Földtábla"}</strong><small>{farmById.get(proposal.farm_id)||"Gazdaság"} · {new Date(proposal.created_at).toLocaleString("hu-HU")} · {proposal.has_boundary?"Teljes poligon":"Csak helypont"} · {proposal.geometry_source==="external"?"Külső forrás":"Kézi jelölés"}</small>{proposal.note&&<small style={{display:"block",marginTop:5}}>Gazda megjegyzése: {proposal.note}</small>}</div><Link className="btn btn-primary" href={`/admin/map/proposals/${proposal.id}`}>Térképi ellenőrzés →</Link></div>)}</div>}
        {(proposals??[]).length===200&&<small>Az első 200 függő javaslat látható. A lista az elbírálások után automatikusan felszabadul.</small>}
      </section>}
  </main>;
}
