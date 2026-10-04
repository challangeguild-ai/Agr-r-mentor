import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {DailyPriorityBoard} from "@/components/DailyPriorityBoard";
import {DailyAlertStrip} from "@/components/DailyAlertStrip";
import {DailyWorkSummary} from "@/components/DailyWorkSummary";
import {TaskLifecycleBoard} from "@/components/TaskLifecycleBoard";
import {prioritizeDailyWork,type DailyWorkInput} from "@/lib/dailyWorkPriority";
import {buildDailyAlerts} from "@/lib/dailyWorkAlerts";

function dayKey(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
function seenAfter(seen:string|null|undefined,created:string|null|undefined){return !!seen&&!!created&&new Date(seen).getTime()>=new Date(created).getTime()}

export default async function FarmerDailyWorkPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("full_name,role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");
 if(profile?.role==="advisor")redirect("/admin/daily-work");
 const[{data:tasks},{data:inspections},{data:reports}]=await Promise.all([
  supabase.from("tasks").select("id,title,due_date,priority,status,review_status,completed_at,farm_id,field_id,created_at").eq("assigned_to",user.id).neq("status","done").limit(300),
  supabase.from("inspections").select("id,field_id,condition,next_check_at,inspected_at,issue_status").neq("issue_status","resolved").limit(300),
  supabase.from("farmer_reports").select("id,title,status,field_id,created_at,advisor_reply,replied_at").neq("status","closed").limit(200)
 ]);
 const reportIds=(reports??[]).map(r=>r.id);
 const{data:receipts}=reportIds.length?await supabase.from("communication_receipts").select("entity_id,last_seen_at").eq("entity_type","farmer_report").eq("viewer_id",user.id).in("entity_id",reportIds):{data:[]};
 const receiptMap=new Map((receipts??[]).map(r=>[r.entity_id,r.last_seen_at]));
 const items:DailyWorkInput[]=[
  ...(tasks??[]).map(t=>({id:t.id,kind:"task" as const,title:t.title,dueAt:t.due_date,createdAt:t.created_at,priority:t.priority,status:t.status,farmId:t.farm_id,fieldId:t.field_id})),
  ...(inspections??[]).filter(i=>i.condition==="critical"||!!i.next_check_at).map(i=>({id:i.id,kind:"inspection" as const,title:i.condition==="critical"?"Kritikus szemle":"Visszaellenőrzés",dueAt:i.next_check_at,createdAt:i.inspected_at,condition:i.condition,status:i.issue_status,fieldId:i.field_id})),
  ...(reports??[]).filter(r=>!!r.advisor_reply&&!!r.replied_at&&!seenAfter(receiptMap.get(r.id),r.replied_at)).map(r=>({id:r.id,kind:"report" as const,title:r.title,dueAt:null,createdAt:r.replied_at||r.created_at,status:r.status,unread:true,fieldId:r.field_id}))
 ];
 const prioritized=prioritizeDailyWork(items),alerts=buildDailyAlerts(items,dayKey(),"farmer");
 const lifecycleTasks=(tasks??[]).map(t=>({id:t.id,title:t.title,status:t.status,reviewStatus:t.review_status,completedAt:t.completed_at,fieldId:t.field_id,dueDate:t.due_date}));
 return <div className="app-shell farmer-app"><Sidebar active="daily-work" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard"><FarmerTopbar userName={profile?.full_name||"Gazdálkodó"}/>
  <header className="topbar daily-work-heading"><div><span className="eyebrow">NAPI MUNKAVÉGZÉS 2.1</span><h1>Mai munkaközpont</h1><p>A határidők, kritikus táblák, visszaellenőrzések és valóban új szakmai jelzések prioritási sorrendben.</p></div></header>
  <DailyWorkSummary items={prioritized}/>
  <DailyAlertStrip alerts={alerts}/>
  <TaskLifecycleBoard tasks={lifecycleTasks} scope="farmer"/>
  <DailyPriorityBoard items={items} title="Mai gazdálkodói prioritások" scope="farmer"/>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">MŰKÖDÉSI ELV</span><h2>Mitől kerül valami előre?</h2></div></div><div style={{padding:14,lineHeight:1.65}}><p>A rendszer előresorolja a lejárt és ma esedékes munkákat, a kritikus táblaállapotokat, a sürgős feladatokat és a ténylegesen még nem látott szakmai válaszokat.</p><p style={{marginBottom:0}}><strong>Fontos:</strong> a sorrend döntéstámogatás. Nem végez automatikus jóváhagyást, nem zár le feladatot és nem ír át szakmai adatot.</p></div></section>
 </main></div>;
}
