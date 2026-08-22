"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdvisor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "advisor") redirect("/dashboard");
  return { supabase, user };
}

async function notify(supabase:any,user_id:string,kind:string,title:string,message:string|null,href:string|null){
  const { error } = await supabase.from("notifications").insert({ user_id, kind, title, message, href });
  if (error) throw new Error(error.message);
}

async function emailNotify(supabase:any,target_user_id:string,subject:string,message:string,href:string){
  try {
    const { error } = await supabase.functions.invoke("send-notification-email",{body:{target_user_id,subject,message,href}});
    if(error) console.error("E-mail értesítés sikertelen",error);
  } catch(error) {
    console.error("E-mail értesítés kivétel",error);
  }
}

async function extractFunctionError(error:unknown){
  if(!error||typeof error!=="object") return "Ismeretlen Edge Function hiba.";
  const c=error as{message?:string;context?:Response};
  if(c.context){try{const p=await c.context.clone().json();if(p?.error)return String(p.error);if(p?.message)return String(p.message)}catch{}}
  return c.message||"Ismeretlen Edge Function hiba.";
}

function validDate(value:string){
  if(!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

export async function inviteFarmer(formData:FormData){
  const{supabase}=await requireAdvisor();
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const full_name=String(formData.get("full_name")||"").trim();
  if(!email||!email.includes("@")||!full_name) throw new Error("Név és érvényes e-mail cím szükséges.");
  if(full_name.length>120) throw new Error("A név túl hosszú.");
  const{data,error}=await supabase.functions.invoke("invite-farmer",{body:{email,full_name,redirect_to:"https://agr-r-mentor.vercel.app/invite"}});
  if(error) throw new Error(`A meghívás sikertelen: ${await extractFunctionError(error)}`);
  if(data?.error) throw new Error(`A meghívás sikertelen: ${data.error}`);
  revalidatePath("/admin");
}

export async function createFarm(formData:FormData){
  const{supabase}=await requireAdvisor();
  const owner_id=String(formData.get("owner_id")||"");
  const name=String(formData.get("name")||"").trim();
  const settlement=String(formData.get("settlement")||"").trim();
  const address=String(formData.get("address")||"").trim();
  if(!owner_id||!name) throw new Error("Gazdálkodó és gazdaságnév megadása kötelező.");
  if(name.length>120||settlement.length>120||address.length>250) throw new Error("Az egyik megadott szöveg túl hosszú.");
  const{data:owner}=await supabase.from("profiles").select("id,role").eq("id",owner_id).maybeSingle();
  if(!owner||owner.role!=="farmer") throw new Error("A kiválasztott felhasználó nem gazdálkodó.");
  const{error}=await supabase.from("farms").insert({owner_id,name,settlement:settlement||null,address:address||null});
  if(error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createField(formData:FormData){
  const{supabase}=await requireAdvisor();
  const farm_id=String(formData.get("farm_id")||"");
  const name=String(formData.get("name")||"").trim();
  const current_crop=String(formData.get("current_crop")||"").trim();
  const raw=String(formData.get("area_ha")||"").replace(",",".").trim();
  const area_ha=raw?Number(raw):null;
  if(!farm_id||!name) throw new Error("Gazdaság és táblanév megadása kötelező.");
  if(name.length>120||current_crop.length>120) throw new Error("A megadott név túl hosszú.");
  if(area_ha!==null&&(!Number.isFinite(area_ha)||area_ha<=0||area_ha>100000)) throw new Error("Érvényes, pozitív hektárértéket adj meg.");
  const{data:farm}=await supabase.from("farms").select("id").eq("id",farm_id).maybeSingle();
  if(!farm) throw new Error("A kiválasztott gazdaság nem található.");
  const{error}=await supabase.from("fields").insert({farm_id,name,current_crop:current_crop||null,area_ha,crop_year:new Date().getFullYear()});
  if(error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function createTask(formData:FormData){
  const{supabase,user}=await requireAdvisor();
  const farm_id=String(formData.get("farm_id")||"");
  const field_id=String(formData.get("field_id")||"");
  const title=String(formData.get("title")||"").trim();
  const description=String(formData.get("description")||"").trim();
  const due_date=String(formData.get("due_date")||"");
  const priority=String(formData.get("priority")||"normal");
  if(!farm_id||!title) throw new Error("Gazdaság és teendő neve kötelező.");
  if(title.length>180||description.length>3000) throw new Error("A teendő szövege túl hosszú.");
  if(!validDate(due_date)) throw new Error("Érvénytelen határidő.");
  const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",farm_id).maybeSingle();
  if(!farm) throw new Error("A gazdaság nem található.");
  if(field_id){
    const{data:field}=await supabase.from("fields").select("id,farm_id").eq("id",field_id).maybeSingle();
    if(!field||field.farm_id!==farm_id) throw new Error("A kiválasztott földtábla nem ehhez a gazdasághoz tartozik.");
  }
  const safePriority=["normal","high","urgent"].includes(priority)?priority:"normal";
  const{error}=await supabase.from("tasks").insert({farm_id,field_id:field_id||null,title,description:description||null,due_date:due_date||null,priority:safePriority,status:"open",assigned_to:farm.owner_id,created_by:user.id});
  if(error) throw new Error(error.message);
  const href=field_id?`/fields/${field_id}`:"/dashboard";
  await notify(supabase,farm.owner_id,"task","Új teendő",title,href);
  await emailNotify(supabase,farm.owner_id,safePriority==="urgent"?"Sürgős új teendő":"Új teendő",`${title}${due_date?`\nHatáridő: ${due_date}`:""}${description?`\n${description}`:""}`,href);
  revalidatePath("/admin");revalidatePath("/dashboard");if(field_id)revalidatePath(`/fields/${field_id}`);
}

export async function createInspection(formData:FormData):Promise<string>{
  const{supabase,user}=await requireAdvisor();
  const field_id=String(formData.get("field_id")||"");
  const inspected_at=String(formData.get("inspected_at")||"");
  const condition=String(formData.get("condition")||"");
  const notes=String(formData.get("notes")||"").trim();
  const recommendation=String(formData.get("recommendation")||"").trim();
  const shouldCreateTask=String(formData.get("create_task")||"")==="yes";
  const taskTitle=String(formData.get("task_title")||"").trim();
  const taskDue=String(formData.get("task_due_date")||"");
  const taskPriority=String(formData.get("task_priority")||"normal");
  if(!field_id||!condition) throw new Error("Földtábla és állapot megadása kötelező.");
  if(!["good","attention","critical"].includes(condition)) throw new Error("Érvénytelen szemleállapot.");
  if(!validDate(inspected_at)||!validDate(taskDue)) throw new Error("Érvénytelen dátum.");
  if(notes.length>5000||recommendation.length>5000||taskTitle.length>180) throw new Error("Az egyik megadott szöveg túl hosszú.");
  if(shouldCreateTask&&!taskTitle) throw new Error("A teendő neve kötelező.");
  const{data:field}=await supabase.from("fields").select("farm_id").eq("id",field_id).maybeSingle();
  if(!field) throw new Error("A földtábla nem található.");
  const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",field.farm_id).maybeSingle();
  if(!farm) throw new Error("A gazdaság nem található.");
  const date=inspected_at?new Date(`${inspected_at}T12:00:00`).toISOString():new Date().toISOString();
  const{data:i,error}=await supabase.from("inspections").insert({field_id,advisor_id:user.id,inspected_at:date,condition,notes:notes||null,recommendation:recommendation||null}).select("id").single();
  if(error||!i) throw new Error(error?.message||"A szemle mentése sikertelen.");
  const{error:timelineError}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id,event_type:"inspection",title:"Táblaszemle",description:[notes,recommendation?`Javaslat: ${recommendation}`:""].filter(Boolean).join(" · ")||null,event_at:date,created_by:user.id,source_id:i.id});
  if(timelineError) throw new Error(timelineError.message);
  const href=`/fields/${field_id}`;
  await notify(supabase,farm.owner_id,"inspection","Új táblaszemle",recommendation||notes||"Új szemle került rögzítésre.",href);
  await emailNotify(supabase,farm.owner_id,"Új táblaszemle és szaktanácsadói javaslat",recommendation||notes||"Új szemle került rögzítésre.",href);
  if(shouldCreateTask){
    const priority=["normal","high","urgent"].includes(taskPriority)?taskPriority:"normal";
    const{data:task,error:taskError}=await supabase.from("tasks").insert({farm_id:field.farm_id,field_id,title:taskTitle,description:recommendation||notes||"A táblaszemle alapján kiadott teendő.",due_date:taskDue||null,priority,status:"open",assigned_to:farm.owner_id,created_by:user.id}).select("id").single();
    if(taskError||!task) throw new Error(taskError?.message||"A teendő létrehozása sikertelen.");
    const{error:taskTimelineError}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id,event_type:"task",title:`Teendő kiadva: ${taskTitle}`,description:recommendation||null,event_at:new Date().toISOString(),created_by:user.id,source_id:task.id});
    if(taskTimelineError) throw new Error(taskTimelineError.message);
    await notify(supabase,farm.owner_id,"task","Új teendő a szemléből",taskTitle,href);
    await emailNotify(supabase,farm.owner_id,priority==="urgent"?"Sürgős teendő a táblaszemle alapján":"Új teendő a táblaszemle alapján",`${taskTitle}${taskDue?`\nHatáridő: ${taskDue}`:""}${recommendation?`\n${recommendation}`:""}`,href);
  }
  revalidatePath("/admin");revalidatePath("/dashboard");revalidatePath(href);
  return i.id;
}

export async function handleReport(formData:FormData){
  const{supabase,user}=await requireAdvisor();
  const report_id=String(formData.get("report_id")||"");
  const reply=String(formData.get("reply")||"").trim();
  const action=String(formData.get("action")||"reply");
  if(!report_id) throw new Error("Hiányzó bejelentés.");
  if(!["reply","reply_task","close"].includes(action)) throw new Error("Érvénytelen művelet.");
  if(reply.length>5000) throw new Error("A válasz túl hosszú.");
  const{data:report,error:rerr}=await supabase.from("farmer_reports").select("id,field_id,farmer_id,title,status").eq("id",report_id).single();
  if(rerr||!report) throw new Error("A bejelentés nem található.");
  const{data:field}=await supabase.from("fields").select("farm_id,name").eq("id",report.field_id).maybeSingle();
  if(!field) throw new Error("A földtábla nem található.");
  const{data:farm}=await supabase.from("farms").select("owner_id").eq("id",field.farm_id).maybeSingle();
  if(!farm||farm.owner_id!==report.farmer_id) throw new Error("A bejelentés gazdálkodója nem egyezik a földtábla tulajdonosával.");
  const now=new Date().toISOString();
  const href=`/fields/${report.field_id}`;
  if(action==="close"){
    if(report.status==="closed") return;
    const{error}=await supabase.from("farmer_reports").update({status:"closed",closed_at:now,updated_at:now}).eq("id",report_id).neq("status","closed");
    if(error) throw new Error(error.message);
    await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id:report.field_id,event_type:"report_closed",title:"Bejelentés lezárva",description:report.title,event_at:now,created_by:user.id,source_id:report.id});
    await notify(supabase,report.farmer_id,"report_closed","Bejelentés lezárva",report.title,href);
    await emailNotify(supabase,report.farmer_id,"Bejelentés lezárva",`A(z) „${report.title}” bejelentés lezárásra került.`,href);
  } else {
    if(report.status==="closed") throw new Error("Lezárt bejelentésre nem küldhető új válasz.");
    if(!reply) throw new Error("Írj választ a gazdálkodónak.");
    const{error}=await supabase.from("farmer_reports").update({advisor_reply:reply,replied_at:now,replied_by:user.id,status:"reviewed",updated_at:now}).eq("id",report_id).neq("status","closed");
    if(error) throw new Error(error.message);
    await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id:report.field_id,event_type:"advisor_reply",title:"Szaktanácsadói válasz",description:reply,event_at:now,created_by:user.id,source_id:report.id});
    await notify(supabase,report.farmer_id,"advisor_reply","Szaktanácsadói válasz érkezett",report.title,href);
    await emailNotify(supabase,report.farmer_id,"Szaktanácsadói válasz érkezett",`${report.title}\n\n${reply}`,href);
    if(action==="reply_task"){
      const taskTitle=String(formData.get("task_title")||"").trim()||`Teendő: ${report.title}`;
      const due=String(formData.get("due_date")||"");
      const rawPriority=String(formData.get("priority")||"normal");
      if(taskTitle.length>180) throw new Error("A teendő neve túl hosszú.");
      if(!validDate(due)) throw new Error("Érvénytelen teendő-határidő.");
      const priority=["normal","high","urgent"].includes(rawPriority)?rawPriority:"normal";
      const{error:te}=await supabase.from("tasks").insert({farm_id:field.farm_id,field_id:report.field_id,title:taskTitle,description:reply,due_date:due||null,priority,status:"open",assigned_to:report.farmer_id,created_by:user.id});
      if(te) throw new Error(te.message);
      await notify(supabase,report.farmer_id,"task","Új teendő a válaszhoz",taskTitle,href);
      await emailNotify(supabase,report.farmer_id,priority==="urgent"?"Sürgős új teendő":"Új teendő a szaktanácsadói válaszhoz",`${taskTitle}${due?`\nHatáridő: ${due}`:""}\n${reply}`,href);
    }
  }
  revalidatePath("/admin");revalidatePath("/dashboard");revalidatePath(href);
}
