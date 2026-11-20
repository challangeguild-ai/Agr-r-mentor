"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {encodeTaskProof,gpsFixFreshEnough,pointInBoundary,pointInBoundaryHole,nearestBoundaryDistance,distanceMeters} from "@/lib/taskProof";
import {notifyAdvisors} from "@/lib/workflowNotifications";
import {parseDecimalOrNull,validDateOnly} from "@/lib/operationInput";
import {budapestCalendarDate} from "@/lib/weather/rollingPrecipitation";
import {productUseBlockingReason} from "@/lib/productUseStatus";

function optionalNumber(v:FormDataEntryValue|null,label="érték"){const n=parseDecimalOrNull(String(v??""));if(n!==null&&n<0)throw new Error(`Érvénytelen ${label}: negatív szám nem adható meg.`);return n}

export async function completeVerifiedTask(formData:FormData){
 let persistAttempted=false;
 try{
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  const taskId=String(formData.get("task_id")||""),lat=Number(String(formData.get("lat")||"").replace(",",".")),lng=Number(String(formData.get("lng")||"").replace(",",".")),accuracy=Number(String(formData.get("accuracy")||"").replace(",",".")),gpsCapturedAt=Number(String(formData.get("gps_captured_at")||"")),photoPath=String(formData.get("photo_path")||"").trim(),photoName=String(formData.get("photo_name")||"").trim();
  const finishedHours=optionalNumber(formData.get("finished_hours"),"záró üzemóra"),workedHectares=optionalNumber(formData.get("worked_hectares"),"megművelt hektár"),actualDose=optionalNumber(formData.get("actual_dose"),"tényleges dózis"),actualArea=optionalNumber(formData.get("actual_area"),"kezelt terület"),actualQuantity=optionalNumber(formData.get("actual_quantity"),"tényleges mennyiség"),doseUnit=String(formData.get("dose_unit")||"").trim(),quantityUnit=String(formData.get("quantity_unit")||"").trim(),weather=String(formData.get("weather")||"").trim(),notes=String(formData.get("execution_notes")||"").trim(),operationDate=String(formData.get("operation_date")||budapestCalendarDate());
  if(!taskId)throw new Error("Hiányzó teendő.");if(!validDateOnly(operationDate))throw new Error("Érvénytelen munkavégzési dátum.");
  if(operationDate>budapestCalendarDate())throw new Error("Jövőbeli dátumra nem küldhető be végrehajtott munka.");if(notes.length>3000||weather.length>1000)throw new Error("A végrehajtási megjegyzés túl hosszú.");
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error("Érvényes GPS-pozíció szükséges a munka beküldéséhez.");if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>200)throw new Error("A GPS pontossága nem megfelelő. Menj szabad ég alá, majd kérj új pozíciót.");if(!gpsFixFreshEnough(gpsCapturedAt,Date.now()))throw new Error("A GPS-mérés túl régi vagy érvénytelen. Kérj új, legfeljebb 15 perces GPS-pozíciót.");if(!photoPath||!photoName)throw new Error("A munka beküldéséhez helyszíni fotó szükséges.");if(!photoPath.startsWith(`${user.id}/task-proofs/${taskId}/`))throw new Error("Érvénytelen fotóhivatkozás.");
  const{data:task,error:taskError}=await supabase.from("tasks").select("id,title,farm_id,field_id,assigned_to,status,task_kind").eq("id",taskId).eq("assigned_to",user.id).maybeSingle();if(taskError||!task)throw new Error("A teendő nem található vagy nincs hozzá jogosultságod.");if(task.status==="done"||task.status==="submitted")return{ok:true,submitted:false};if(!task.field_id)throw new Error("GPS-validált beküldés csak földtáblához kapcsolt munkánál használható.");
  const[{data:ownFarm},{data:activeMembership}]=await Promise.all([
   supabase.from("farms").select("id").eq("id",task.farm_id).eq("owner_id",user.id).maybeSingle(),
   supabase.from("farm_members").select("id").eq("farm_id",task.farm_id).eq("user_id",user.id).eq("active",true).maybeSingle()
  ]);
  if(!ownFarm&&!activeMembership)throw new Error("Ehhez a gazdasághoz már nincs aktív jogosultságod.");
  if(task.task_kind==="operation"){
   const{data:plan}=await supabase.from("task_operation_plans").select("operation_type,product_id,plant_protection_use_id,dose_min,dose_max,dose_unit,country_code").eq("task_id",taskId).maybeSingle();
   const spraying=plan&&(plan.operation_type==="spraying"||plan.operation_type==="plant_protection");
   if(spraying){
    if(!plan?.product_id||!plan?.plant_protection_use_id)throw new Error("A növényvédelmi terv hivatalos készítmény- vagy felhasználási kapcsolata hiányzik. Végrehajtás előtt a tervet javítani kell.");
    if(actualDose==null)throw new Error("Növényvédelmi műveletnél a tényleges dózis megadása kötelező.");
    const[{data:product},{data:use}]=await Promise.all([supabase.from("plant_protection_products").select("id,country_code,active,regulatory_status,grace_period_until,valid_from,valid_until").eq("id",plan.product_id).maybeSingle(),supabase.from("plant_protection_uses").select("id,product_id,dose_min,dose_max,dose_unit").eq("id",plan.plant_protection_use_id).maybeSingle()]);
    if(!product||product.country_code!==plan.country_code||product.active===false)throw new Error("A készítmény jelenlegi hivatalos státusza alapján a művelet nem küldhető végrehajtottnak.");
    if(!use||use.product_id!==product.id)throw new Error("A hivatalos kultúra/felhasználás kapcsolat már nem igazolható. Ellenőrizd az aktuális engedélyokiratot.");
    const permitError=productUseBlockingReason({country:plan.country_code==="SK"?"SK":"HU",operationDate,active:product.active,
     validFrom:product.valid_from,validUntil:product.valid_until,regulatoryStatus:product.regulatory_status,
     gracePeriodUntil:product.grace_period_until});
    if(permitError)throw new Error(permitError);
    const min=use.dose_min==null?plan.dose_min:Number(use.dose_min),max=use.dose_max==null?plan.dose_max:Number(use.dose_max),officialUnit=use.dose_unit||plan.dose_unit||null;if(max!=null&&actualDose>Number(max))throw new Error(`A tényleges dózis meghaladja a jelenlegi hivatalos maximumot (${max} ${officialUnit||""}).`);if(min!=null&&actualDose<Number(min))throw new Error(`A tényleges dózis kisebb a jelenlegi hivatalos minimumnál (${min} ${officialUnit||""}).`);if(officialUnit&&officialUnit!==doseUnit)throw new Error("A tényleges dózis mértékegysége nem egyezik a jelenlegi hivatalos felhasználással.");
   }
  }
  const{data:field}=await supabase.from("fields").select("id,name,center_lat,center_lng,boundary_geojson").eq("id",task.field_id).eq("farm_id",task.farm_id).maybeSingle();if(!field)throw new Error("A földtábla nem található.");
  let validation:"inside_boundary"|"near_boundary"|"near_center"|null=null,distance:number|null=null;
  if(field.boundary_geojson){if(pointInBoundary(lat,lng,field.boundary_geojson))validation="inside_boundary";else if(!pointInBoundaryHole(lat,lng,field.boundary_geojson)){distance=nearestBoundaryDistance(lat,lng,field.boundary_geojson);if(distance!==null&&distance<=150)validation="near_boundary"}}
  else if(field.center_lat!=null&&field.center_lng!=null){distance=distanceMeters(lat,lng,Number(field.center_lat),Number(field.center_lng));if(distance<=500)validation="near_center"}
  else throw new Error("Ehhez a táblához még nincs térképi adat. GPS-validált beküldés előtt rögzíteni kell a táblahatárt vagy középpontot.");
  if(!validation)throw new Error(`A GPS alapján nem vagy a munkaterületen${distance!==null?` (kb. ${Math.round(distance)} m távolság)`:""}.`);
  const proof=encodeTaskProof({lat,lng,accuracy,photoPath,photoName,capturedAt:new Date(gpsCapturedAt).toISOString(),distanceMeters:distance,validation});persistAttempted=true;
  const{error}=await supabase.rpc("submit_verified_task_execution",{p_task_id:taskId,p_proof:proof,p_operation_date:operationDate,p_actual_dose:actualDose,p_dose_unit:doseUnit||null,p_actual_area:actualArea,p_actual_quantity:actualQuantity,p_quantity_unit:quantityUnit||null,p_weather:weather||null,p_notes:notes||null,p_finished_hours:finishedHours,p_worked_hectares:workedHectares});if(error)throw new Error(error.message);
  const href="/admin/tasks?view=submitted";try{await notifyAdvisors(supabase,{kind:"task_submitted_review",title:"Munka ellenőrzésre vár",message:`${task.title} · ${field.name}`,href,eventKey:`task:${task.id}:submitted`,emailSubject:"Munka ellenőrzésre vár",emailMessage:`${task.title}\n${field.name}\nGPS és helyszíni fotó rögzítve. A végrehajtás szaktanácsadói visszaigazolásra vár.`});
  }catch(notificationError){console.error("A végrehajtás elmentve, de az értesítés sikertelen",notificationError)}
  for(const path of [`/fields/${task.field_id}`,"/dashboard","/tasks","/work","/admin","/admin/workday","/admin/tasks"]){
   try{revalidatePath(path)}catch(e){console.error("A végrehajtás utáni frissítés sikertelen",e)}
  }
  return{ok:true,submitted:true};
 }catch(e){console.error("completeVerifiedTask",e);return{ok:false,submitted:false,safeToRemoveProof:!persistAttempted,error:e instanceof Error?e.message:"A munka beküldése sikertelen."};}
}
