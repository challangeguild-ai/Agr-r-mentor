"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TASK_PROOF_EVENT,encodeTaskProof,pointInBoundary,nearestBoundaryDistance,distanceMeters} from "@/lib/taskProof";

export async function completeTask(formData:FormData){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const taskId=String(formData.get("task_id")||"");
  if(!taskId)throw new Error("Hiányzó teendő.");
  if(!formData.has("lat")||!formData.has("photo_path"))redirect(`/tasks?view=open&verify=${encodeURIComponent(taskId)}`);
  const lat=Number(String(formData.get("lat")||"").replace(",","."));
  const lng=Number(String(formData.get("lng")||"").replace(",","."));
  const accuracy=Number(String(formData.get("accuracy")||"").replace(",","."));
  const photoPath=String(formData.get("photo_path")||"").trim();
  const photoName=String(formData.get("photo_name")||"").trim();
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error("Érvényes GPS-pozíció szükséges a munka lezárásához.");
  if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>200)throw new Error("A GPS pontossága nem megfelelő. Menj szabad ég alá, majd kérj új pozíciót.");
  if(!photoPath||!photoName)throw new Error("A munka lezárásához helyszíni fotó szükséges.");
  if(!photoPath.startsWith(`${user.id}/task-proofs/${taskId}/`))throw new Error("Érvénytelen fotóhivatkozás.");

  const{data:task,error:taskError}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status").eq("id",taskId).eq("assigned_to",user.id).maybeSingle();
  if(taskError||!task)throw new Error("A teendő nem található vagy nincs hozzá jogosultságod.");
  if(task.status==="done")return;
  if(!task.field_id)throw new Error("GPS-validált lezárás csak földtáblához kapcsolt munkánál használható.");

  const{data:field}=await supabase.from("fields").select("id,name,center_lat,center_lng,boundary_geojson").eq("id",task.field_id).maybeSingle();
  if(!field)throw new Error("A földtábla nem található.");
  let validation:"inside_boundary"|"near_boundary"|"near_center"|null=null;
  let distance:number|null=null;
  if(field.boundary_geojson){
    if(pointInBoundary(lat,lng,field.boundary_geojson))validation="inside_boundary";
    else{distance=nearestBoundaryDistance(lat,lng,field.boundary_geojson);if(distance!==null&&distance<=150)validation="near_boundary";}
  }else if(field.center_lat!=null&&field.center_lng!=null){distance=distanceMeters(lat,lng,Number(field.center_lat),Number(field.center_lng));if(distance<=500)validation="near_center";}
  else throw new Error("Ehhez a táblához még nincs térképi adat. GPS-validált lezárás előtt rögzíteni kell a táblahatárt vagy középpontot.");
  if(!validation)throw new Error(`A GPS alapján nem vagy a munkaterületen${distance!==null?` (kb. ${Math.round(distance)} m távolság)`:""}. A feladat innen nem zárható le.`);

  const now=new Date().toISOString();
  const proof=encodeTaskProof({lat,lng,accuracy,photoPath,photoName,capturedAt:now,distanceMeters:distance,validation});
  const{data:updated,error}=await supabase.from("tasks").update({status:"done",completed_at:now,updated_at:now}).eq("id",taskId).eq("assigned_to",user.id).neq("status","done").select("id").maybeSingle();
  if(error)throw new Error(error.message);if(!updated)throw new Error("A teendő állapota időközben megváltozott.");
  const href=`/fields/${task.field_id}`;
  const{error:timelineError}=await supabase.from("timeline_events").insert({farm_id:task.farm_id,field_id:task.field_id,event_type:TASK_PROOF_EVENT,title:`GPS-validált munka: ${task.title}`,description:proof,event_at:now,created_by:user.id,source_id:task.id});
  if(timelineError)throw new Error(timelineError.message);revalidatePath(`/fields/${task.field_id}`);
  const{data:advisors}=await supabase.from("profiles").select("id").eq("role","advisor");
  if(advisors?.length){const rows=advisors.map(a=>({user_id:a.id,kind:"task_completed_verified",title:"GPS-validált munka elkészült",message:`${task.title} · ${field.name}`,href}));await supabase.from("notifications").insert(rows);for(const advisor of advisors){try{await supabase.functions.invoke("send-notification-email",{body:{target_user_id:advisor.id,subject:"GPS-validált munka elkészült",message:`${task.title}\n${field.name}\nGPS és helyszíni fotó rögzítve.`,href}})}catch(emailError){console.error("E-mail értesítés sikertelen",emailError)}}}
  revalidatePath("/dashboard");revalidatePath("/tasks");revalidatePath("/admin");revalidatePath("/admin/tasks");
}

export async function saveFieldMap(formData:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")throw new Error("A térképi adatok módosításához szaktanácsadói jogosultság szükséges.");
  const fieldId=String(formData.get("field_id")||"");const latRaw=String(formData.get("center_lat")||"").trim().replace(",",".");const lngRaw=String(formData.get("center_lng")||"").trim().replace(",",".");const geoRaw=String(formData.get("boundary_geojson")||"").trim();if(!fieldId)throw new Error("Hiányzó földtábla.");const center_lat=latRaw?Number(latRaw):null,center_lng=lngRaw?Number(lngRaw):null;if(center_lat!==null&&(!Number.isFinite(center_lat)||center_lat<-90||center_lat>90))throw new Error("Érvénytelen szélességi koordináta.");if(center_lng!==null&&(!Number.isFinite(center_lng)||center_lng<-180||center_lng>180))throw new Error("Érvénytelen hosszúsági koordináta.");let boundary_geojson:any=null;
  if(geoRaw){try{boundary_geojson=JSON.parse(geoRaw)}catch{throw new Error("A táblahatár GeoJSON formátuma hibás.")}if(!boundary_geojson||!["Polygon","MultiPolygon"].includes(boundary_geojson.type)||!Array.isArray(boundary_geojson.coordinates))throw new Error("Csak Polygon vagy MultiPolygon táblahatár menthető.");}
  const{data:field}=await supabase.from("fields").select("id").eq("id",fieldId).maybeSingle();if(!field)throw new Error("A földtábla nem található.");const{error}=await supabase.from("fields").update({center_lat,center_lng,boundary_geojson,boundary_updated_at:new Date().toISOString()}).eq("id",fieldId);if(error)throw new Error(error.message);revalidatePath(`/fields/${fieldId}`);revalidatePath("/map");revalidatePath("/admin/map");revalidatePath("/dashboard");revalidatePath("/admin");
}
