"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {encodeTaskProof,pointInBoundary,nearestBoundaryDistance,distanceMeters} from "@/lib/taskProof";

function optionalNumber(v:FormDataEntryValue|null){
  const s=String(v||"").trim().replace(",",".");
  if(!s)return null;
  const n=Number(s);
  if(!Number.isFinite(n)||n<0)throw new Error("Érvénytelen géphasználati érték.");
  return n;
}

export async function completeVerifiedTask(formData:FormData){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");

  const taskId=String(formData.get("task_id")||"");
  const lat=Number(String(formData.get("lat")||"").replace(",","."));
  const lng=Number(String(formData.get("lng")||"").replace(",","."));
  const accuracy=Number(String(formData.get("accuracy")||"").replace(",","."));
  const photoPath=String(formData.get("photo_path")||"").trim();
  const photoName=String(formData.get("photo_name")||"").trim();
  const finishedHours=optionalNumber(formData.get("finished_hours"));
  const workedHectares=optionalNumber(formData.get("worked_hectares"));

  if(!taskId)throw new Error("Hiányzó teendő.");
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error("Érvényes GPS-pozíció szükséges a munka lezárásához.");
  if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>200)throw new Error("A GPS pontossága nem megfelelő. Menj szabad ég alá, majd kérj új pozíciót.");
  if(!photoPath||!photoName)throw new Error("A munka lezárásához helyszíni fotó szükséges.");
  if(!photoPath.startsWith(`${user.id}/task-proofs/${taskId}/`))throw new Error("Érvénytelen fotóhivatkozás.");

  const{data:task,error:taskError}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status").eq("id",taskId).eq("assigned_to",user.id).maybeSingle();
  if(taskError||!task)throw new Error("A teendő nem található vagy nincs hozzá jogosultságod.");
  if(task.status==="done")return {ok:true};
  if(!task.field_id)throw new Error("GPS-validált lezárás csak földtáblához kapcsolt munkánál használható.");

  const{data:field}=await supabase.from("fields").select("id,name,center_lat,center_lng,boundary_geojson").eq("id",task.field_id).maybeSingle();
  if(!field)throw new Error("A földtábla nem található.");

  let validation:"inside_boundary"|"near_boundary"|"near_center"|null=null;
  let distance:number|null=null;
  if(field.boundary_geojson){
    if(pointInBoundary(lat,lng,field.boundary_geojson))validation="inside_boundary";
    else{
      distance=nearestBoundaryDistance(lat,lng,field.boundary_geojson);
      if(distance!==null&&distance<=150)validation="near_boundary";
    }
  }else if(field.center_lat!=null&&field.center_lng!=null){
    distance=distanceMeters(lat,lng,Number(field.center_lat),Number(field.center_lng));
    if(distance<=500)validation="near_center";
  }else throw new Error("Ehhez a táblához még nincs térképi adat. GPS-validált lezárás előtt rögzíteni kell a táblahatárt vagy középpontot.");

  if(!validation)throw new Error(`A GPS alapján nem vagy a munkaterületen${distance!==null?` (kb. ${Math.round(distance)} m távolság)`:""}. A feladat innen nem zárható le.`);

  const now=new Date().toISOString();
  const proof=encodeTaskProof({lat,lng,accuracy,photoPath,photoName,capturedAt:now,distanceMeters:distance,validation});
  const{data:assignment}=await supabase.from("task_machine_assignments").select("machine_id").eq("task_id",taskId).maybeSingle();
  const{error:completeError}=await supabase.rpc("complete_verified_task",{p_task_id:taskId,p_proof:proof,p_finished_hours:finishedHours,p_worked_hectares:workedHectares});
  if(completeError)throw new Error(completeError.message);

  const href=`/fields/${task.field_id}`;
  const{data:advisors}=await supabase.from("profiles").select("id").eq("role","advisor");
  if(advisors?.length){
    const rows=advisors.map(a=>({user_id:a.id,kind:"task_completed_verified",title:"GPS-validált munka elkészült",message:`${task.title} · ${field.name}`,href}));
    await supabase.from("notifications").insert(rows);
    for(const advisor of advisors){
      try{
        await supabase.functions.invoke("send-notification-email",{body:{target_user_id:advisor.id,subject:"GPS-validált munka elkészült",message:`${task.title}\n${field.name}\nGPS és helyszíni fotó rögzítve.${assignment?"\nGéphasználat naplózva.":""}`,href}});
      }catch(error){console.error("E-mail értesítés sikertelen",error)}
    }
  }

  revalidatePath(`/fields/${task.field_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/work");
  revalidatePath("/admin");
  revalidatePath("/admin/workday");
  revalidatePath("/admin/tasks");
  revalidatePath("/machines");
  revalidatePath("/admin/machines");
  return {ok:true};
}
