"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validDateOnly} from "@/lib/operationInput";
import {encodeHotspot,HOTSPOT_EVENT} from "@/lib/hotspots";

type ProblemMarker={lat:number;lng:number;label:string;severity:"critical"|"attention"};

function optionalDate(value:string){return !value||validDateOnly(value)}

function parseProblemMarkers(raw:FormDataEntryValue|null):ProblemMarker[]{
 try{
  const value=JSON.parse(String(raw||"[]"));
  if(!Array.isArray(value))return [];
  return value.slice(0,50).filter((item:any)=>{
   const lat=Number(item?.lat),lng=Number(item?.lng);
   return item?.lat!=null&&item?.lng!=null&&item.lat!==""&&item.lng!==""&&Number.isFinite(lat)&&Number.isFinite(lng)
    &&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  }).map((item:any)=>({
   lat:Number(item.lat),lng:Number(item.lng),
   label:String(item.label||"Helyszíni probléma").slice(0,180),
   severity:item.severity==="critical"?"critical":"attention"
  }));
 }catch{return []}
}

async function emailNotify(supabase:any,targetUserId:string,subject:string,message:string,href:string,eventKey:string){
 try{
  const{error}=await supabase.functions.invoke("send-notification-email",{body:{target_user_id:targetUserId,subject,message,href,event_key:eventKey}});
  if(error){console.error("Szemle e-mail értesítés sikertelen",error);return false}
  return true;
 }catch(error){console.error("Szemle e-mail értesítés sikertelen",error);return false}
}

export async function createInspection(formData:FormData):Promise<{id:string;warnings:string[]}>{
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor"||profile?.system_role==="admin")
  redirect(profile?.system_role==="admin"?"/system-admin":"/dashboard");

 const fieldId=String(formData.get("field_id")||"");
 const inspectedAt=String(formData.get("inspected_at")||"");
 const condition=String(formData.get("condition")||"");
 const notes=String(formData.get("notes")||"").trim();
 const recommendation=String(formData.get("recommendation")||"").trim();
 const farmerMessage=String(formData.get("farmer_message")||"").trim();
 const notifyFarmer=String(formData.get("notify_farmer")||"")==="yes";
 const follow=String(formData.get("follow_up_status")||"");
 const nextCheck=String(formData.get("next_check_at")||"");
 const issueStatus=String(formData.get("issue_status")||"open");
 const gpsLatRaw=String(formData.get("gps_lat")||"");
 const gpsLngRaw=String(formData.get("gps_lng")||"");
 const gpsLat=Number(gpsLatRaw),gpsLng=Number(gpsLngRaw);
 const gpsAccuracy=Number(formData.get("gps_accuracy_m"));
 const problemMarkers=parseProblemMarkers(formData.get("problem_markers"));
 const shouldCreateTask=String(formData.get("create_task")||"")==="yes";
 const taskTitle=String(formData.get("task_title")||"").trim();
 const taskDue=String(formData.get("task_due_date")||"");
 const taskPriority=String(formData.get("task_priority")||"normal");

 if(!fieldId||!["good","attention","critical"].includes(condition))
  throw new Error("Földtábla és érvényes állapot szükséges.");
 if(!optionalDate(inspectedAt)||!optionalDate(taskDue)||!optionalDate(nextCheck))
  throw new Error("Érvénytelen dátum.");
 if(!["","improved","unchanged","worsened"].includes(follow)||!["open","monitoring","resolved"].includes(issueStatus))
  throw new Error("Érvénytelen visszaellenőrzési állapot.");
 if(notes.length>5000||recommendation.length>5000||farmerMessage.length>5000||taskTitle.length>180)
  throw new Error("Az egyik megadott szöveg túl hosszú.");
 if(shouldCreateTask&&!taskTitle)throw new Error("A teendő neve kötelező.");

 const{data:field}=await supabase.from("fields").select("farm_id,name").eq("id",fieldId).maybeSingle();
 if(!field)throw new Error("A földtábla nem található.");
 const{data:farm}=await supabase.from("farms").select("owner_id,name").eq("id",field.farm_id).maybeSingle();
 if(!farm)throw new Error("A gazdaság nem található.");
 const{data:previous}=await supabase.from("inspections").select("id,condition,inspected_at")
  .eq("field_id",fieldId).order("inspected_at",{ascending:false}).limit(1).maybeSingle();

 const date=inspectedAt?new Date(`${inspectedAt}T12:00:00`).toISOString():new Date().toISOString();
 const payload:Record<string,unknown>={
  field_id:fieldId,advisor_id:user.id,inspected_at:date,condition,
  notes:notes||null,recommendation:recommendation||null,
  follow_up_status:follow||null,previous_inspection_id:previous?.id||null,
  next_check_at:nextCheck||null,issue_status:issueStatus,
  closed_at:issueStatus==="resolved"?new Date().toISOString():null,
  problem_markers:problemMarkers
 };
 if(gpsLatRaw&&gpsLngRaw&&Number.isFinite(gpsLat)&&Number.isFinite(gpsLng)&&gpsLat>=-90&&gpsLat<=90&&gpsLng>=-180&&gpsLng<=180){
  payload.gps_lat=gpsLat;
  payload.gps_lng=gpsLng;
  payload.gps_accuracy_m=Number.isFinite(gpsAccuracy)&&gpsAccuracy>=0?gpsAccuracy:null;
 }
 const{data:inspection,error:inspectionError}=await supabase.from("inspections").insert(payload).select("id").single();
 if(inspectionError||!inspection)throw new Error(inspectionError?.message||"A szemle mentése sikertelen.");

 // A szemle ekkor már létrejött. Innen egy mellékfolyamat hibája nem jelenthet teljes mentési hibát.
 const warnings:string[]=[];
 const followLabel=follow==="improved"?"Javult":follow==="unchanged"?"Változatlan":follow==="worsened"?"Romlott":null;
 const description=[
  recommendation?`Javaslat: ${recommendation}`:"",
  farmerMessage?`Gazdálkodónak: ${farmerMessage}`:"",
  problemMarkers.length?`${problemMarkers.length} GPS-es problémapont rögzítve`:"",
  followLabel?`Előző szemléhez képest: ${followLabel}`:"",
  nextCheck?`Következő ellenőrzés: ${nextCheck}`:"",
  issueStatus==="resolved"?"Probléma lezárva":""
 ].filter(Boolean).join(" · ")||null;

 try{
  const{error}=await supabase.from("timeline_events").insert({
   farm_id:field.farm_id,field_id:fieldId,event_type:previous?"inspection_followup":"inspection",
   title:previous?"Visszaellenőrző táblaszemle":"Táblaszemle",
   description,event_at:date,created_by:user.id,source_id:inspection.id
  });
  if(error)warnings.push("A szemle idővonaleseménye nem mentődött el.");
 }catch(error){console.error("Szemle idővonal hiba",error);warnings.push("A szemle idővonala nem ellenőrizhető.")}

 if(problemMarkers.length){
  try{
   const{error}=await supabase.from("timeline_events").insert(problemMarkers.map(marker=>({
    farm_id:field.farm_id,field_id:fieldId,event_type:HOTSPOT_EVENT,title:marker.label,
    description:encodeHotspot({
     type:"other",severity:marker.severity==="critical"?"critical":"warning",
     lat:marker.lat,lng:marker.lng,notes:marker.label,resolved:false,resolvedAt:null
    }),
    event_at:date,created_by:user.id,source_id:inspection.id
   })));
   if(error)warnings.push("A szemléből származó GPS-problémapontok nem mind kerültek az idővonalra.");
  }catch(error){console.error("Szemle GPS-pont mentési hiba",error);warnings.push("A GPS-problémapontok mentése nem ellenőrizhető.")}
 }

 const href=`/fields/${fieldId}#inspection-${inspection.id}`;
 if(notifyFarmer&&farmerMessage){
  const conditionLabel=condition==="good"?"Jó állapot":condition==="attention"?"Figyelmet igényel":"Kritikus";
  const title=previous?"Szaktanácsadói visszaellenőrzés":"Szaktanácsadói táblaszemle";
  try{
   const{error}=await supabase.from("notifications").insert({
    user_id:farm.owner_id,kind:"inspection",title,message:`${field.name}: ${farmerMessage}`,href,
    event_key:`inspection:${inspection.id}:farmer`
   });
   if(error)warnings.push("A gazdálkodói alkalmazásértesítés nem jött létre.");
  }catch(error){console.error("Szemle értesítési hiba",error);warnings.push("A gazdálkodói értesítés mentése nem ellenőrizhető.")}
  const mail=[
   `Gazdaság: ${farm.name}`,`Földtábla: ${field.name}`,
   `Szemle időpontja: ${inspectedAt||new Date().toISOString().slice(0,10)}`,
   `Állapot: ${conditionLabel}`,followLabel?`Előző szemléhez képest: ${followLabel}`:"",
   `Szaktanácsadói észrevétel: ${farmerMessage}`,
   nextCheck?`Következő javasolt ellenőrzés: ${nextCheck}`:"",
   shouldCreateTask&&taskTitle?`Kapcsolódó teendő: ${taskTitle}${taskDue?` – határidő: ${taskDue}`:""}`:""
  ].filter(Boolean).join("\n");
  if(!await emailNotify(supabase,farm.owner_id,title,mail,href,`inspection:${inspection.id}:farmer`))
   warnings.push("A szemléről szóló e-mail küldése nem igazolható.");
 }

 if(shouldCreateTask){
  const priority=["normal","high","urgent"].includes(taskPriority)?taskPriority:"normal";
  let taskId:string|null=null;
  try{
   const{data:task,error}=await supabase.from("tasks").insert({
    farm_id:field.farm_id,field_id:fieldId,title:taskTitle,
    description:recommendation||farmerMessage||"A táblaszemle alapján kiadott teendő.",
    due_date:taskDue||null,priority,status:"open",
    assigned_to:farm.owner_id,created_by:user.id
   }).select("id").single();
   if(error||!task)warnings.push("A kapcsolódó teendő létrejötte nem igazolható. Ellenőrizd a teendőlistát; a szemlét ne rögzítsd újra.");
   else taskId=task.id;
  }catch(error){console.error("Szemléből teendő készítése sikertelen",error);warnings.push("A kapcsolódó teendő mentése bizonytalan. Ellenőrizd a teendőlistát.")}
  if(taskId){
   try{
    const{error}=await supabase.from("timeline_events").insert({
     farm_id:field.farm_id,field_id:fieldId,event_type:"task",
     title:`Teendő kiadva: ${taskTitle}`,description:recommendation||farmerMessage||null,
     event_at:new Date().toISOString(),created_by:user.id,source_id:taskId
    });
    if(error)warnings.push("A kapcsolódó teendő idővonaleseménye hiányzik.");
   }catch(error){console.error("Szemle teendő idővonal hiba",error);warnings.push("A teendő idővonala nem ellenőrizhető.")}
   try{
    const{error}=await supabase.from("notifications").insert({
     user_id:farm.owner_id,kind:"task",title:"Új teendő a szemléből",
     message:taskTitle,href:`/fields/${fieldId}#task-${taskId}`
    });
    if(error)warnings.push("A kapcsolódó teendő értesítése nem sikerült.");
   }catch(error){console.error("Szemle teendő értesítési hiba",error);warnings.push("A teendő értesítése nem ellenőrizhető.")}
  }
 }
 try{
  revalidatePath("/admin");revalidatePath("/admin/inspections");
  revalidatePath("/admin/priorities");revalidatePath("/dashboard");
  revalidatePath(`/fields/${fieldId}`);
 }catch(error){console.error("Szemle nézetfrissítési hiba",error);warnings.push("A szemle elmentődött, de a listák frissülése késhet.")}
 return{id:inspection.id,warnings};
}
