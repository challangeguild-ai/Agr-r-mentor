"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {parseFieldGeometryText} from "@/lib/fieldGeometry";

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

  let geometry:null|Record<string,unknown>=null;
  try{if(boundaryText)geometry=parseFieldGeometryText(boundaryText).geometry}
  catch(error){return{ok:false,message:error instanceof Error?error.message:"A táblahatár nem dolgozható fel."}}

  const {error}=await supabase.rpc("submit_field_boundary_proposal",{
    p_field_id:fieldId,p_center_lat:lat,p_center_lng:lng,p_boundary_geojson:geometry,
    p_geometry_source:source,p_note:note
  });
  if(error){
    if(error.code==="23505")return{ok:false,message:"Ehhez a táblához már van ellenőrzésre váró javaslat."};
    return{ok:false,message:error.message||"A javaslat beküldése sikertelen."};
  }
  revalidatePath(`/fields/${fieldId}`);
  revalidatePath("/admin/map/proposals");
  return{ok:true,message:"A javaslatot elküldtük. A táblahatár csak a szaktanácsadó jóváhagyása után változik meg."};
}
