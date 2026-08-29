import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {DailyPriorityBoard} from "@/components/DailyPriorityBoard";
import {DailyAlertStrip} from "@/components/DailyAlertStrip";
import {DailyWorkSummary} from "@/components/DailyWorkSummary";
import {DailyWorkLegend} from "@/components/DailyWorkLegend";
import {prioritizeDailyWork,type DailyWorkInput} from "@/lib/dailyWorkPriority";
import {buildDailyAlerts} from "@/lib/dailyWorkAlerts";

function dayKey(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}

export default async function FarmerDailyWorkPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
 if(profile?.role==="advisor")redirect("/admin/daily-work");
 const[{data:tasks},{data:inspections},{data:reports}]=await Promise.all([
  supabase.from("tasks").select("id,title,due_date,priority,status,farm_id,field_id,created_at").eq("assigned_to",user.id).neq("status","done").limit(300),
  supabase.from("inspections").select("id,field_id,condition,next_check_at,inspected_at,issue_status").neq("issue_status","resolved").limit(300),
  supabase.from("farmer_reports").select("id,title,status,field_id,created_at,advisor_reply").neq("status","closed").limit(200)
 ]);
 const items:DailyWorkInput[]=[
  ...(tasks??[]).map(t=>({id:t.id,kind:"task" as const,title:t.title,dueAt:t.due_date,createdAt:t.created_at,priority:t.priority,status:t.status,farmId:t.farm_id,fieldId:t.field_id})),
  ...(inspections??[]).filter(i=>i.condition==="critical"||!!i.next_check_at).map(i=>({id:i.id,kind:"inspection" as const,title:`${i.condition==="critical"?"Kritikus szemle":"Visszaellenőrzés"}`,dueAt:i.next_check_at,createdAt:i.inspected_at,condition:i.condition,status:i.issue_status,fieldId:i.field_id})),
  ...(reports??[]).filter(r=>!!r.advisor_reply).map(r=>({id:r.id,kind:"report" as const,title:r.title,dueAt:null,createdAt:r.created_at,status:r.status,unread:true,fieldId:r.field_id}))
 ];
 const prioritized=prioritizeDailyWork(items),alerts=buildDailyAlerts(items,dayKey());
 return <div className="app-shell farmer-app"><Sidebar active="daily-work" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard">
  <header className="topbar"><div><span className="eyebrow">NAPI MUNKAVÉGZÉS 2.0</span><h1>Mai munkaközpont</h1><p>A határidők, kritikus táblák, visszaellenőrzések és új szakmai jelzések automatikus prioritási sorrendben.</p></div><DailyWorkLegend/></header>
  <DailyWorkSummary items={prioritized}/>
  <DailyAlertStrip alerts={alerts}/>
  <DailyPriorityBoard items={items} title="Mai gazdálkodói prioritások" scope="farmer"/>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">MŰKÖDÉSI ELV</span><h2>Mitől kerül valami előre?</h2></div></div><div style={{padding:14,lineHeight:1.65}}><p>A rendszer előresorolja a lejárt és ma esedékes munkákat, a kritikus táblaállapotokat, a sürgős feladatokat és az új szakmai jelzéseket.</p><p style={{marginBottom:0}}><strong>Fontos:</strong> a sorrend döntéstámogatás. Nem végez automatikus jóváhagyást, nem zár le feladatot és nem ír át szakmai adatot.</p></div></section>
 </main></div>;
}
