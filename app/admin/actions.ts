"use server";
import {getInviteRedirectUrl} from "@/lib/inviteRedirect";
import {extractFunctionError} from "@/lib/edgeFunctionError";
import {validDateOnly} from "@/lib/operationInput";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

async function requireAdvisor(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")redirect("/dashboard");return{supabase,user}}
async function notify(s:any,user_id:string,kind:string,title:string,message:string|null,href:string|null){const{error}=await s.from("notifications").insert({user_id,kind,title,message,href});if(error)console.error("Értesítés sikertelen",error)}
async function emailNotify(s:any,target_user_id:string,subject:string,message:string,href:string){try{const{error}=await s.functions.invoke("send-notification-email",{body:{target_user_id,subject,message,href}});if(error)console.error("E-mail értesítés sikertelen",error)}catch(e){console.error(e)}}

function validDate(v:string){return !v||validDateOnly(v)}
function refreshAdmin(ownerId?:string,farmId?:string,fieldId?:string){revalidatePath("/admin");revalidatePath("/admin/clients");revalidatePath("/admin/workday");revalidatePath("/admin/priorities");if(ownerId)revalidatePath(`/admin/clients/${ownerId}`);if(ownerId&&farmId)revalidatePath(`/admin/clients/${ownerId}/farms/${farmId}`);if(fieldId)revalidatePath(`/fields/${fieldId}`)}

export async function inviteFarmer(formData:FormData){const{supabase}=await requireAdvisor();const email=String(formData.get("email")||"").trim().toLowerCase(),full_name=String(formData.get("full_name")||"").trim();if(!email||!email.includes("@")||!full_name)throw new Error("Név és érvényes e-mail cím szükséges.");if(full_name.length>120||email.length>250)throw new Error("A megadott adat túl hosszú.");const{data,error}=await supabase.functions.invoke("invite-farmer",{body:{email,full_name,redirect_to:getInviteRedirectUrl()}});if(error)throw new Error(`A meghívás sikertelen: ${await extractFunctionError(error)}`);if(data?.error)throw new Error(`A meghívás sikertelen: ${data.error}`);refreshAdmin()}

export async function createFarm(formData:FormData){const{supabase}=await requireAdvisor();const owner_id=String(formData.get("owner_id")||""),name=String(formData.get("name")||"").trim(),settlement=String(formData.get("settlement")||"").trim(),address=String(formData.get("address")||"").trim();if(!owner_id||!name)throw new Error("Gazdálkodó és gazdaságnév megadása kötelező.");if(name.length>120||settlement.length>120||address.length>250)throw new Error("Az egyik megadott szöveg túl hosszú.");const{data:owner}=await supabase.from("profiles").select("id,role").eq("id",owner_id).maybeSingle();if(!owner||owner.role!=="farmer")throw new Error("A kiválasztott felhasználó nem gazdálkodó.");let q=supabase.from("farms").select("id").eq("owner_id",owner_id).ilike("name",name);if(settlement)q=q.ilike("settlement",settlement);else q=q.is("settlement",null);if(address)q=q.ilike("address",address);else q=q.is("address",null);const{data:duplicate}=await q.limit(1).maybeSingle();if(duplicate)throw new Error("Ez a gazdaság már létezik ennél a gazdálkodónál.");const{data:farm,error}=await supabase.from("farms").insert({owner_id,name,settlement:settlement||null,address:address||null}).select("id").single();if(error||!farm)throw new Error(error?.message||"A gazdaság létrehozása sikertelen.");refreshAdmin(owner_id,farm.id)}

export async function createField(formData:FormData){const{supabase}=await requireAdvisor();const farm_id=String(formData.get("farm_id")||""),name=String(formData.get("name")||"").trim(),current_crop=String(formData.get("current_crop")||"").trim(),raw=String(formData.get("area_ha")||"").replace(",",".").trim(),area_ha=raw?Number(raw):null,settlement=String(formData.get("settlement")||"").trim(),parcel_number=String(formData.get("parcel_number")||"").trim();if(!farm_id||!name)throw new Error("Gazdaság és táblanév megadása kötelező.");if(name.length>120||current_crop.length>120)throw new Error("A megadott név túl hosszú.");if(parcel_number&&!settlement)throw new Error("A helyrajzi szám mellé települést is adj meg.");if(settlement.length>120||parcel_number.length>80)throw new Error("A település vagy a helyrajzi szám túl hosszú.");if(area_ha!==null&&(!Number.isFinite(area_ha)||area_ha<=0||area_ha>100000))throw new Error("Érvényes, pozitív hektárértéket adj meg.");const{data:farm}=await supabase.from("farms").select("id,owner_id").eq("id",farm_id).maybeSingle();if(!farm)throw new Error("A kiválasztott gazdaság nem található.");const{data:duplicate}=await supabase.from("fields").select("id").eq("farm_id",farm_id).ilike("name",name).limit(1).maybeSingle();if(duplicate)throw new Error("Ilyen nevű földtábla már létezik ebben a gazdaságban.");const{data:field,error}=await supabase.from("fields").insert({farm_id,name,current_crop:current_crop||null,area_ha,settlement:settlement||null,parcel_number:parcel_number||null,crop_year:new Date().getFullYear()}).select("id").single();if(error||!field)throw new Error(error?.message||"A földtábla létrehozása sikertelen.");refreshAdmin(farm.owner_id,farm_id,field.id);revalidatePath("/admin/map");redirect(`/admin/map?field=${field.id}`)}

export async function createTask(formData:FormData){const{supabase,user}=await requireAdvisor();const farm_id=String(formData.get("farm_id")||""),field_id=String(formData.get("field_id")||""),title=String(formData.get("title")||"").trim(),description=String(formData.get("description")||"").trim(),due_date=String(formData.get("due_date")||""),priority=String(formData.get("priority")||"normal");if(!farm_id||!title)throw new Error("Gazdaság és teendő neve kötelező.");if(title.length>180||description.length>3000)throw new Error("A teendő szövege túl hosszú.");if(!validDate(due_date))throw new Error("Érvénytelen határidő.");const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",farm_id).maybeSingle();if(!farm)throw new Error("A gazdaság nem található.");if(field_id){const{data:field}=await supabase.from("fields").select("id,farm_id").eq("id",field_id).maybeSingle();if(!field||field.farm_id!==farm_id)throw new Error("A kiválasztott földtábla nem ehhez a gazdasághoz tartozik.")}const safePriority=["normal","high","urgent"].includes(priority)?priority:"normal";const{error}=await supabase.from("tasks").insert({farm_id,field_id:field_id||null,title,description:description||null,due_date:due_date||null,priority:safePriority,status:"open",assigned_to:farm.owner_id,created_by:user.id});if(error)throw new Error(error.message);const href=field_id?`/fields/${field_id}`:"/dashboard";await notify(supabase,farm.owner_id,"task","Új teendő",title,href);await emailNotify(supabase,farm.owner_id,safePriority==="urgent"?"Sürgős új teendő":"Új teendő",`${title}${due_date?`\nHatáridő: ${due_date}`:""}${description?`\n${description}`:""}`,href);revalidatePath("/dashboard");revalidatePath("/tasks");revalidatePath("/admin/tasks");refreshAdmin(farm.owner_id,farm_id,field_id||undefined)}

export async function createInspection(formData:FormData):Promise<string>{const{supabase,user}=await requireAdvisor();const field_id=String(formData.get("field_id")||""),inspected_at=String(formData.get("inspected_at")||""),condition=String(formData.get("condition")||""),notes=String(formData.get("notes")||"").trim(),recommendation=String(formData.get("recommendation")||"").trim(),shouldCreateTask=String(formData.get("create_task")||"")==="yes",taskTitle=String(formData.get("task_title")||"").trim(),taskDue=String(formData.get("task_due_date")||""),taskPriority=String(formData.get("task_priority")||"normal");if(!field_id||!condition)throw new Error("Földtábla és állapot megadása kötelező.");if(!["good","attention","critical"].includes(condition))throw new Error("Érvénytelen szemleállapot.");if(!validDate(inspected_at)||!validDate(taskDue))throw new Error("Érvénytelen dátum.");if(notes.length>5000||recommendation.length>5000||taskTitle.length>180)throw new Error("Az egyik megadott szöveg túl hosszú.");if(shouldCreateTask&&!taskTitle)throw new Error("A teendő neve kötelező.");const{data:field}=await supabase.from("fields").select("farm_id").eq("id",field_id).maybeSingle();if(!field)throw new Error("A földtábla nem található.");const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",field.farm_id).maybeSingle();if(!farm)throw new Error("A gazdaság nem található.");const date=inspected_at?new Date(`${inspected_at}T12:00:00`).toISOString():new Date().toISOString();const{data:i,error}=await supabase.from("inspections").insert({field_id,advisor_id:user.id,inspected_at:date,condition,notes:notes||null,recommendation:recommendation||null}).select("id").single();if(error||!i)throw new Error(error?.message||"A szemle mentése sikertelen.");const{error:timelineError}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id,event_type:"inspection",title:"Táblaszemle",description:[notes,recommendation?`Javaslat: ${recommendation}`:""].filter(Boolean).join(" · ")||null,event_at:date,created_by:user.id,source_id:i.id});if(timelineError)throw new Error(timelineError.message);const href=`/fields/${field_id}`;await notify(supabase,farm.owner_id,"inspection","Új táblaszemle",recommendation||notes||"Új szemle került rögzítésre.",href);await emailNotify(supabase,farm.owner_id,"Új táblaszemle és szaktanácsadói javaslat",recommendation||notes||"Új szemle került rögzítésre.",href);if(shouldCreateTask){const priority=["normal","high","urgent"].includes(taskPriority)?taskPriority:"normal";const{data:task,error:taskError}=await supabase.from("tasks").insert({farm_id:field.farm_id,field_id,title:taskTitle,description:recommendation||notes||"A táblaszemle alapján kiadott teendő.",due_date:taskDue||null,priority,status:"open",assigned_to:farm.owner_id,created_by:user.id}).select("id").single();if(taskError||!task)throw new Error(taskError?.message||"A teendő létrehozása sikertelen.");const{error:te}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id,event_type:"task",title:`Teendő kiadva: ${taskTitle}`,description:recommendation||null,event_at:new Date().toISOString(),created_by:user.id,source_id:task.id});if(te)throw new Error(te.message);await notify(supabase,farm.owner_id,"task","Új teendő a szemléből",taskTitle,href);await emailNotify(supabase,farm.owner_id,priority==="urgent"?"Sürgős teendő a táblaszemle alapján":"Új teendő a táblaszemle alapján",`${taskTitle}${taskDue?`\nHatáridő: ${taskDue}`:""}${recommendation?`\n${recommendation}`:""}`,href)}revalidatePath("/dashboard");revalidatePath("/admin/inspections");refreshAdmin(farm.owner_id,field.farm_id,field_id);return i.id}

export type ReportHandlingResult={
 status:"saved"|"already_saved";
 action:"reply"|"reply_task"|"close";
 warnings:string[];
 taskId?:string;
};

export async function handleReport(formData:FormData):Promise<ReportHandlingResult>{
 const{supabase,user}=await requireAdvisor();
 const reportId=String(formData.get("report_id")||"");
 const reply=String(formData.get("reply")||"").trim();
 const action=String(formData.get("action")||"reply") as ReportHandlingResult["action"];
 const taskTitleInput=String(formData.get("task_title")||"").trim();
 const taskDue=String(formData.get("due_date")||"");
 const rawPriority=String(formData.get("priority")||"normal");
 if(!reportId)throw new Error("Hiányzó bejelentés.");
 if(!["reply","reply_task","close"].includes(action))throw new Error("Érvénytelen művelet.");
 if(reply.length>5000)throw new Error("A válasz túl hosszú.");
 if(action!=="close"&&!reply)throw new Error("Írj választ a gazdálkodónak.");
 // Validate every requested task field before updating the report.
 if(action==="reply_task"){
  if(taskTitleInput.length>180)throw new Error("A teendő neve túl hosszú.");
  if(!validDate(taskDue))throw new Error("Érvénytelen teendő-határidő.");
 }
 const{data:report,error:reportError}=await supabase.from("farmer_reports")
  .select("id,field_id,farmer_id,title,status,advisor_reply,updated_at")
  .eq("id",reportId).single();
 if(reportError||!report)throw new Error("A bejelentés nem található.");
 const{data:field}=await supabase.from("fields")
  .select("farm_id,name").eq("id",report.field_id).maybeSingle();
 if(!field)throw new Error("A földtábla nem található.");
 const{data:farm}=await supabase.from("farms")
  .select("owner_id").eq("id",field.farm_id).maybeSingle();
 if(!farm||farm.owner_id!==report.farmer_id)
  throw new Error("A bejelentés gazdálkodója nem egyezik a földtábla tulajdonosával.");
 const farmId=field.farm_id,fieldId=report.field_id,farmerId=report.farmer_id;
 if(action==="close"&&report.status==="closed")
  return{status:"already_saved",action,warnings:[]};
 if(action!=="close"){
  if(report.status==="closed")throw new Error("Lezárt bejelentésre nem küldhető új válasz.");
  if(report.status==="reviewed"&&report.advisor_reply===reply)
   return{
    status:"already_saved",action,
    warnings:action==="reply_task"
     ?["A válasz már mentve van. Új feladat előtt ellenőrizd a teendőlistát; a rendszer nem küldi újra automatikusan."]
     :[]
   };
 }
 const taskTitle=taskTitleInput||`Teendő: ${report.title}`;
 if(action==="reply_task"&&taskTitle.length>180)
  throw new Error("A teendő neve túl hosszú.");

 const now=new Date().toISOString();
 const href=`/fields/${report.field_id}`;
 const changes=action==="close"
  ?{status:"closed",closed_at:now,updated_at:now}
  :{advisor_reply:reply,replied_at:now,replied_by:user.id,status:"reviewed",updated_at:now};
 // Optimistic concurrency: a duplicate request must not confirm the same reply twice.
 let update=supabase.from("farmer_reports").update(changes).eq("id",reportId).neq("status","closed");
 update=report.updated_at?update.eq("updated_at",report.updated_at):update.is("updated_at",null);
 const{data:saved,error:updateError}=await update.select("id").maybeSingle();
 if(updateError||!saved)
  throw new Error(updateError?.message||"A bejelentés időközben módosult. Frissítsd a listát, mielőtt ismét mentenél.");

 const warnings:string[]=[];
 async function addTimeline(eventType:string,title:string,description:string){
  try{
   const{error}=await supabase.from("timeline_events").insert({
    farm_id:farmId,field_id:fieldId,event_type:eventType,
    title,description,event_at:now,created_by:user.id,source_id:reportId
   });
   if(error)throw error;
  }catch(error){
   console.error("Már mentett bejelentés idővonalhiba",error);
   warnings.push("Az idővonal frissítését nem sikerült igazolni.");
  }
 }
 async function sendNotices(kind:string,title:string,message:string,subject:string,emailBody:string){
  try{
   const{error}=await supabase.from("notifications").insert({
    user_id:farmerId,kind,title,message,href
   });
   if(error)throw error;
  }catch(error){
   console.error("Már mentett bejelentés értesítési hiba",error);
   warnings.push("A belső értesítés nem igazolt.");
  }
  try{
   const{data,error}=await supabase.functions.invoke("send-notification-email",{
    body:{target_user_id:farmerId,subject,message:emailBody,href}
   });
   if(error||data?.error)throw error||new Error(String(data.error));
  }catch(error){
   console.error("Már mentett bejelentés e-mail hiba",error);
   warnings.push("Az e-mail küldése nem igazolt.");
  }
 }
 if(action==="close"){
  await addTimeline("report_closed","Bejelentés lezárva",report.title);
  await sendNotices("report_closed","Bejelentés lezárva",report.title,
   "Bejelentés lezárva",`A(z) „${report.title}” bejelentés lezárásra került.`);
 }else{
  await addTimeline("advisor_reply","Szaktanácsadói válasz",reply);
  await sendNotices("advisor_reply","Szaktanácsadói válasz érkezett",report.title,
   "Szaktanácsadói válasz érkezett",`${report.title}\n\n${reply}`);
 }

 let taskId:string|undefined;
 if(action==="reply_task"){
  const priority=["normal","high","urgent"].includes(rawPriority)?rawPriority:"normal";
  try{
   const{data:task,error}=await supabase.from("tasks").insert({
    farm_id:farmId,field_id:fieldId,title:taskTitle,
    description:reply,due_date:taskDue||null,priority,status:"open",
    assigned_to:farmerId,created_by:user.id
   }).select("id").single();
   if(error||!task)throw error||new Error("hiányzó visszaigazolás");
   taskId=task.id;
   await sendNotices("task","Új teendő a válaszhoz",taskTitle,
    priority==="urgent"?"Sürgős új teendő":"Új teendő a szaktanácsadói válaszhoz",
    `${taskTitle}${taskDue?`\nHatáridő: ${taskDue}`:""}\n${reply}`);
  }catch(error){
   console.error("Bejelentés mentve, teendő mentése nem igazolt",error);
   warnings.push("A válasz elmentve, de a teendő mentése nem igazolt. Ellenőrizd a teendőlistát, mielőtt új feladatot hoznál létre.");
  }
 }
 try{
  revalidatePath("/dashboard");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/tasks");
  refreshAdmin(farmerId,farmId,fieldId);
 }catch(error){
  console.error("Bejelentés mentve, gyorsítótár-frissítés sikertelen",error);
  warnings.push("A lista frissítése elmaradt; a bejelentés már mentve van.");
 }
 return{status:"saved",action,warnings,taskId};
}
