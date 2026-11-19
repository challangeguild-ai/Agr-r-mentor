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
  const {data:fieldId,error}=await supabase.rpc("review_field_boundary_proposal",{
    p_proposal_id:id,p_approve:decision==="approve",p_note:note||null
  });
  if(error)redirect(`/admin/map/proposals?error=${encodeURIComponent(error.message)}`);
  if(fieldId){revalidatePath(`/fields/${fieldId}`);revalidatePath("/admin/map");revalidatePath("/map");revalidatePath("/dashboard")}
  revalidatePath("/admin/map/proposals");
  redirect(`/admin/map/proposals?result=${decision==="approve"?"approved":"rejected"}`);
}
