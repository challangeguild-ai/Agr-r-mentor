"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {parseFieldGeometryText,type FieldGeometry} from "@/lib/fieldGeometry";
import {matchesPendingBoundaryProposal} from "@/lib/fieldBoundaryProposalPersistence";

export type BoundaryProposalResult={ok:boolean;message:string};

export async function submitFieldBoundaryProposal(formData:FormData):Promise<BoundaryProposalResult>{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return{ok:false,message:"A javaslat beküldéséhez jelentkezz be újra."};

  const fieldId=String(formData.get("field_id")||"").trim();
  const latitude=String(formData.get("center_lat")||"").trim().replace(",",".");
  const longitude=String(formData.get("center_lng")||"").trim().replace(",",".");
  const boundaryText=String(formData.get("boundary_geojson")||"").trim();
  const source=String(formData.get("boundary_source")||"manual").trim();
  const note=String(formData.get("proposal_note")||"").trim();

  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(fieldId))
    return{ok:false,message:"Érvénytelen földtábla-azonosító."};
  if((!latitude)!==(!longitude))return{ok:false,message:"A térképi pont két koordinátája együtt szükséges."};
  if(!latitude&&!boundaryText)return{ok:false,message:"Jelölj meg legalább egy pontot vagy poligont a térképen."};
  const lat=latitude?Number(latitude):null,lng=longitude?Number(longitude):null;
  if(lat!==null&&(!Number.isFinite(lat)||lat < -90||lat > 90))return{ok:false,message:"Érvénytelen szélességi fok."};
  if(lng!==null&&(!Number.isFinite(lng)||lng < -180||lng > 180))return{ok:false,message:"Érvénytelen hosszúsági fok."};
  if(source!=="manual"&&source!=="external")return{ok:false,message:"A javaslat forrása nem megfelelő."};
  if(note.length>1000)return{ok:false,message:"A megjegyzés legfeljebb 1000 karakter lehet."};
  if(boundaryText.length>2_000_000)return{ok:false,message:"Túl nagy térképi fájl."};

  let geometry:FieldGeometry|null=null;
  try{if(boundaryText)geometry=parseFieldGeometryText(boundaryText).geometry}
  catch(error){return{ok:false,message:error instanceof Error?error.message:"A táblahatár nem dolgozható fel."}}

  function refreshViews(){
    for(const path of [`/fields/${fieldId}`,"/admin/map/proposals"]){
      try{revalidatePath(path)}catch(error){console.error("Mentett határjavaslat nézetfrissítése sikertelen",error)}
    }
  }
  let submitError:{code?:string;message?:string}|null=null;
  try{
    const {data,error}=await supabase.rpc("submit_field_boundary_proposal",{
      p_field_id:fieldId,p_center_lat:lat,p_center_lng:lng,p_boundary_geojson:geometry,
      p_geometry_source:source,p_note:note
    });
    if(error)submitError=error;
    else if(typeof data!=="string")submitError={message:"A beküldés eredménye nem igazolható."};
  }catch(error){
    submitError={message:error instanceof Error?error.message:"A hálózati beküldés megszakadt."};
  }

  if(submitError){
    // A timeout or duplicate-key response can arrive after a successful commit.
    // Only the current user's matching pending row confirms this submission.
    try{
      const {data:pending,error:lookupError}=await supabase.from("field_boundary_proposals")
        .select("center_lat,center_lng,boundary_geojson,geometry_source,note")
        .eq("field_id",fieldId).eq("proposed_by",user.id).eq("status","pending")
        .limit(1).maybeSingle();
      if(!lookupError&&matchesPendingBoundaryProposal(pending,{centerLat:lat,centerLng:lng,geometry,source,note})){
        refreshViews();
        return{ok:true,message:"A korábban elmentett javaslatot megtaláltuk. Ellenőrzésre vár; ne küldd be még egyszer."};
      }
      if(lookupError)console.error("A határjavaslat mentés utáni ellenőrzése sikertelen",lookupError);
    }catch(error){console.error("A határjavaslat állapotellenőrzése megszakadt",error)}
    if(submitError.code==="23505")return{ok:false,message:"Ehhez a táblához már van ellenőrzésre váró javaslat. Nézd meg az adatlapján, mielőtt újabbat készítesz."};
    return{ok:false,message:`A beküldés eredménye nem igazolható (${submitError.message||"ismeretlen hiba"}). Frissítsd a földtábla adatlapját; ne küldd be vakon újra.`};
  }
  refreshViews();
  return{ok:true,message:"A javaslatot elküldtük. A táblahatár csak a szaktanácsadó jóváhagyása után változik meg."};
}
