"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function dispatchTask(formData:FormData){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const farmId=String(formData.get("farm_id")||""),fieldId=String(formData.get("field_id")||""),assignedTo=String(formData.get("assigned_to")||""),machineId=String(formData.get("machine_id")||""),title=String(formData.get("title")||"").trim(),description=String(formData.get("description")||"").trim(),dueDate=String(formData.get("due_date")||""),priority=String(formData.get("priority")||"normal");
 if(!farmId||!fieldId||!assignedTo||!title)throw new Error("Gazdaság, földtábla, munkatárs és feladat megadása kötelező.");
 if(title.length>180||description.length>3000)throw new Error("A feladat szövege túl hosszú.");
 const{data:farm}=await supabase.from("farms").select("id,owner_id,name").eq("id",farmId).maybeSingle();if(!farm)throw new Error("A gazdaság nem található.");
 let canDispatch=farm.owner_id===user.id;if(!canDispatch){const{data:manager}=await supabase.from("farm_members").select("id,member_role").eq("farm_id",farmId).eq("user_id",user.id).eq("active",true).in("member_role",["manager","agronomist"]).maybeSingle();canDispatch=!!manager}if(!canDispatch)throw new Error("Ehhez a gazdasághoz nincs munkakiosztási jogosultságod.");
 const{data:field}=await supabase.from("fields").select("id,name,farm_id").eq("id",fieldId).eq("farm_id",farmId).maybeSingle();if(!field)throw new Error("A földtábla nem ehhez a gazdasághoz tartozik.");
 const assigneeIsOwner=assignedTo===farm.owner_id;let assigneeOk=assigneeIsOwner;if(!assigneeOk){const{data:member}=await supabase.from("farm_members").select("id,active").eq("farm_id",farmId).eq("user_id",assignedTo).eq("active",true).maybeSingle();assigneeOk=!!member}if(!assigneeOk)throw new Error("A kiválasztott munkatárs nem aktív tagja ennek a gazdaságnak.");
 if(machineId){const{data:machine}=await supabase.from("machines").select("id,farm_id,active").eq("id",machineId).maybeSingle();if(!machine||machine.farm_id!==farmId||!machine.active)throw new Error("A kiválasztott gép nem használható ehhez a gazdasághoz.")}
 const safePriority=["normal","high","urgent"].includes(priority)?priority:"normal";const{data:task,error}=await supabase.from("tasks").insert({farm_id:farmId,field_id:fieldId,title,description:description||null,due_date:dueDate||null,priority:safePriority,status:"open",assigned_to:assignedTo,created_by:user.id}).select("id").single();if(error||!task)throw new Error(error?.message||"A munka kiosztása sikertelen.");
 if(machineId){const{error:machineError}=await supabase.from("task_machine_assignments").insert({task_id:task.id,machine_id:machineId,assigned_by:user.id});if(machineError)throw new Error(machineError.message)}
 const now=new Date().toISOString();await supabase.from("timeline_events").insert({farm_id:farmId,field_id:fieldId,event_type:"task",title:`Munka kiosztva: ${title}`,description:description||null,event_at:now,created_by:user.id,source_id:task.id});
 const href=assigneeIsOwner?`/fields/${fieldId}`:"/work";await supabase.from("notifications").insert({user_id:assignedTo,kind:"task",title:"Új munka kiosztva",message:`${title} · ${field.name}`,href});try{await supabase.functions.invoke("send-notification-email",{body:{target_user_id:assignedTo,subject:safePriority==="urgent"?"Sürgős munka kiosztva":"Új munka kiosztva",message:`${title}\n${farm.name} · ${field.name}${dueDate?`\nHatáridő: ${dueDate}`:""}${description?`\n${description}`:""}`,href}})}catch(e){console.error("Munkakiosztási e-mail sikertelen",e)}
 revalidatePath("/dispatch");revalidatePath("/work");revalidatePath("/tasks");revalidatePath(`/fields/${fieldId}`);revalidatePath("/admin/tasks");revalidatePath("/machines");
}
