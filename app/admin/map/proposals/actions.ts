"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function reviewFieldBoundaryProposal(formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor"||profile.system_role==="admin")redirect("/dashboard");
  const id=String(formData.get("proposal_id")||"").trim();
  const decision=String(formData.get("decision")||"");
  const note=String(formData.get("review_note")||"").trim();
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
      ||(decision!=="approve"&&decision!=="reject")||note.length>1000){
    redirect("/admin/map/proposals?error=Érvénytelen+elbírálási+adatok");
  }
  if(decision==="approve"&&formData.get("confirmed")!=="on")
    redirect("/admin/map/proposals?error=A+térképi+ellenőrzés+megerősítése+szükséges");
  let fieldId:string|null=null;
  let reviewError:string|null=null;
  try{
    const {data,error}=await supabase.rpc("review_field_boundary_proposal",{
      p_proposal_id:id,p_approve:decision==="approve",p_note:note||null
    });
    if(error)reviewError=error.message||"Az elbírálás nem igazolható.";
    else if(typeof data==="string")fieldId=data;
    else reviewError="Az elbírálás eredménye nem igazolható.";
  }catch(error){reviewError=error instanceof Error?error.message:"A kapcsolat megszakadt az elbírálás közben."}

  if(!fieldId){
    // When the response is lost after commit, check that this advisor's exact
    // decision and note were persisted before offering an unsafe repeat.
    try{
      const {data:reviewed,error:lookupError}=await supabase.from("field_boundary_proposals")
        .select("field_id,status,reviewed_by,review_note").eq("id",id).maybeSingle();
      if(!lookupError&&reviewed?.reviewed_by===user.id
        &&reviewed.status===(decision==="approve"?"approved":"rejected")
        &&String(reviewed.review_note||"").trim()===note)fieldId=reviewed.field_id;
      if(lookupError)console.error("Táblahatár-elbírálás állapotellenőrzése sikertelen",lookupError);
    }catch(error){console.error("Táblahatár-elbírálás állapotellenőrzése megszakadt",error)}
  }
  if(!fieldId)redirect(`/admin/map/proposals?error=${encodeURIComponent((reviewError||"Az elbírálás állapota nem igazolható. Ellenőrizd a javaslatlistát, mielőtt újra döntesz.").slice(0,280))}`);
  for(const path of [`/fields/${fieldId}`,"/admin/map","/map","/dashboard","/admin/map/proposals"]){
    try{revalidatePath(path)}catch(error){console.error("Mentett táblahatár-eljárás nézetfrissítése sikertelen",error)}
  }
  redirect(`/admin/map/proposals?result=${decision==="approve"?"approved":"rejected"}`);
}
