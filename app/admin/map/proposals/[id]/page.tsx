import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {FieldBoundaryComparisonMap} from "@/components/FieldBoundaryComparisonMap";
import {FieldBoundaryQualityPanel} from "@/components/FieldBoundaryQualityPanel";
import {assessFieldBoundary} from "@/lib/fieldBoundaryQuality";
import {reviewFieldBoundaryProposal} from "../actions";

export default async function ReviewBoundaryProposal({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor"||profile?.system_role==="admin")redirect("/dashboard");
  const {data:proposal,error}=await supabase.from("field_boundary_proposals").select("*").eq("id",id).maybeSingle();
  if(error||!proposal)notFound();
  const [{data:field},{data:farm},{data:neighbors,count:neighborsCount,error:neighborsError}]=await Promise.all([
    supabase.from("fields").select("id,name,area_ha,center_lat,center_lng,boundary_geojson,boundary_updated_at,geometry_source,farm_id").eq("id",proposal.field_id).maybeSingle(),
    supabase.from("farms").select("name").eq("id",proposal.farm_id).maybeSingle(),
    supabase.from("fields").select("id,name,boundary_geojson",{count:"exact"}).eq("farm_id",proposal.farm_id).neq("id",proposal.field_id).not("boundary_geojson","is",null).limit(50)
  ]);
  if(!field||field.farm_id!==proposal.farm_id)notFound();
  const stale=(field.boundary_updated_at?new Date(field.boundary_updated_at).getTime():null)!==
    (proposal.base_boundary_updated_at?new Date(proposal.base_boundary_updated_at).getTime():null);
  const pending=proposal.status==="pending";
  let quality:ReturnType<typeof assessFieldBoundary>|null=null;
  try{
    quality=assessFieldBoundary({geometry:proposal.boundary_geojson,proposedLat:proposal.center_lat,proposedLng:proposal.center_lng,oldLat:field.center_lat,oldLng:field.center_lng,oldBoundary:field.boundary_geojson,declaredHa:field.area_ha,neighbors:(neighbors??[]).map(n=>({id:n.id,name:n.name,boundary:n.boundary_geojson})),neighborsTruncated:!!neighborsError||(neighborsCount??0)>50});
  }catch{/* A hibás korábbi geometria nem akadályozhatja az elutasítást. */}

  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">SZAKTANÁCSADÓI TÉRKÉPI ELLENŐRZÉS</span><h1>{field.name} – táblahatár-javaslat</h1><p>{farm?.name||"Gazdaság"} · {field.area_ha?`${field.area_ha} ha · `:""}{new Date(proposal.created_at).toLocaleString("hu-HU")} · {proposal.boundary_geojson?"Poligon":"Csak térképi pont"}</p></div></header>
    <AdminNav active="map-proposals"/>
    <p><Link className="ghost-btn" href="/admin/map/proposals">← Vissza az elbírálási listához</Link></p>
    {stale&&<div role="alert" className="panel" style={{margin:"12px 0",borderColor:"#c7832b"}}><strong>⚠ A tábla térképi adatai a beküldés óta megváltoztak.</strong><p>Ez a javaslat már nem hagyható jóvá; utasítsd el, és kérj új beküldést. Így nem írható felül frissebb határ.</p></div>}
    <FieldBoundaryComparisonMap previous={{lat:field.center_lat,lng:field.center_lng,boundary:field.boundary_geojson}} proposed={{lat:proposal.center_lat,lng:proposal.center_lng,boundary:proposal.boundary_geojson}}/>
    <section className="panel" style={{marginTop:14}}><h2 style={{fontSize:18,marginBottom:12}}>Automatikus összevetés a nyilvántartással</h2>{quality?<FieldBoundaryQualityPanel quality={quality}/>:<p role="alert">A javaslat automatikus ellenőrzése nem sikerült; csak kézi szemle után hozz döntést.</p>}</section>
    <section className="panel" style={{marginTop:16}}><span className="eyebrow">ELBÍRÁLÁSI ADATOK</span><h2>{pending?"Javaslat ellenőrzése":proposal.status==="approved"?"Jóváhagyott javaslat":"Elutasított javaslat"}</h2>
      <p>Forrás: {proposal.geometry_source==="external"?"külső ingyenes vagy saját állomány (nem hitelesített)":"kézi térképi jelölés"}. {proposal.boundary_geojson?"A teljes szabálytalan poligon minden töréspontjával kerül átvezetésre.":"Csak helypont: jóváhagyáskor a korábbi poligon eltávolításra kerül, ha volt."}</p>
      {proposal.note&&<p><strong>Gazda megjegyzése:</strong> {proposal.note}</p>}
      <p style={{fontSize:13,color:"#526253"}}>Hasonlítsd össze az alakzatot a műholdképpel és a gazdaság nyilvántartásával. Az OSM vagy a feltöltött térkép nem hivatalos földhivatali hitelesítés; a művelt tábla eltérhet a helyrajzi számtól.</p>
      {pending?<form action={reviewFieldBoundaryProposal} style={{display:"grid",gap:12}}><input type="hidden" name="proposal_id" value={proposal.id}/><label htmlFor="review-note" style={{fontWeight:700}}>Elbírálási megjegyzés (opcionális)</label><textarea id="review-note" name="review_note" rows={3} maxLength={1000} style={{padding:12,border:"1px solid #d7e2d6",borderRadius:9,font:"inherit"}} placeholder="Melyik rész megfelelő, vagy mit kell javítani?"/><label style={{display:"flex",gap:8,alignItems:"center",fontSize:13}}><input type="checkbox" name="confirmed"/> Megnéztem a közös térképet, és ellenőriztem a javasolt határ helyét. Jóváhagyás esetén a tábla térképi adatai lecserélődnek.</label><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button type="submit" name="decision" value="approve" className="btn btn-primary" disabled={stale}>Poligon / helypont jóváhagyása</button><button type="submit" name="decision" value="reject" className="btn btn-secondary">Elutasítás, javítás kérése</button></div></form>:<p role="status">Az elbírálás megtörtént.{proposal.review_note?` Megjegyzés: ${proposal.review_note}`:""}</p>}
      <p><Link href={`/admin/map?field=${field.id}`} className="ghost-btn">Földtábla térképi szerkesztése →</Link></p>
    </section>
  </main>;
}
