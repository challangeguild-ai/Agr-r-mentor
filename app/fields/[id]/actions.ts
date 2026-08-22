"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function completeTask(formData:FormData){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const taskId=String(formData.get("task_id")||"");
  if(!taskId)throw new Error("Hiányzó teendő.");
  const{data:task,error:taskError}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status").eq("id",taskId).single();
  if(taskError||!task)throw new Error("A teendő nem található.");
  if(task.assigned_to!==user.id)throw new Error("Ehhez a teendőhöz nincs jogosultságod.");
  if(task.status==="done")return;
  const now=new Date().toISOString();
  const{error}=await supabase.from("tasks").update({status:"done",completed_at:now,updated_at:now}).eq("id",taskId);
  if(error)throw new Error(error.message);
  const href=task.field_id?`/fields/${task.field_id}`:"/admin";
  if(task.field_id){
    await supabase.from("timeline_events").insert({farm_id:task.farm_id,field_id:task.field_id,event_type:"task_completed",title:"Teendő elvégezve",description:task.title,event_at:now,created_by:user.id,source_id:task.id});
    revalidatePath(`/fields/${task.field_id}`);
  }
  const{data:advisors}=await supabase.from("profiles").select("id").eq("role","advisor");
  if(advisors?.length){
    const rows=advisors.map(a=>({user_id:a.id,kind:"task_completed",title:"Teendő elvégezve",message:task.title,href}));
    await supabase.from("notifications").insert(rows);
    for(const advisor of advisors){try{await supabase.functions.invoke("send-notification-email",{body:{target_user_id:advisor.id,subject:"Gazdálkodói teendő elvégezve",message:task.title,href}})}catch(emailError){console.error("E-mail értesítés sikertelen",emailError)}}
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function saveFieldMap(formData:FormData){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")throw new Error("A térképi adatok módosításához szaktanácsadói jogosultság szükséges.");
  const fieldId=String(formData.get("field_id")||"");
  const latRaw=String(formData.get("center_lat")||"").trim().replace(",",".");
  const lngRaw=String(formData.get("center_lng")||"").trim().replace(",",".");
  const geoRaw=String(formData.get("boundary_geojson")||"").trim();
  if(!fieldId)throw new Error("Hiányzó földtábla.");
  const center_lat=latRaw?Number(latRaw):null,center_lng=lngRaw?Number(lngRaw):null;
  if(center_lat!==null&&(!Number.isFinite(center_lat)||center_lat<-90||center_lat>90))throw new Error("Érvénytelen szélességi koordináta.");
  if(center_lng!==null&&(!Number.isFinite(center_lng)||center_lng<-180||center_lng>180))throw new Error("Érvénytelen hosszúsági koordináta.");
  let boundary_geojson:any=null;
  if(geoRaw){
    try{boundary_geojson=JSON.parse(geoRaw)}catch{throw new Error("A táblahatár GeoJSON formátuma hibás.")}
    if(!boundary_geojson||!["Polygon","MultiPolygon"].includes(boundary_geojson.type)||!Array.isArray(boundary_geojson.coordinates))throw new Error("Csak Polygon vagy MultiPolygon táblahatár menthető.");
  }
  const{error}=await supabase.from("fields").update({center_lat,center_lng,boundary_geojson,boundary_updated_at:new Date().toISOString()}).eq("id",fieldId);
  if(error)throw new Error(error.message);
  revalidatePath(`/fields/${fieldId}`);revalidatePath("/dashboard");revalidatePath("/admin");
}
