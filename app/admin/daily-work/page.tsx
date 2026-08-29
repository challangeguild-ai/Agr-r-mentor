import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {DailyPriorityBoard} from "@/components/DailyPriorityBoard";
import {DailyAlertStrip} from "@/components/DailyAlertStrip";
import {DailyWorkSummary} from "@/components/DailyWorkSummary";
import {DailyWorkLegend} from "@/components/DailyWorkLegend";
import {TaskLifecycleBoard} from "@/components/TaskLifecycleBoard";
import {FollowUpSuggestionBoard} from "@/components/FollowUpSuggestionBoard";
import {prioritizeDailyWork,type DailyWorkInput} from "@/lib/dailyWorkPriority";
import {buildDailyAlerts} from "@/lib/dailyWorkAlerts";
import {buildFollowUpSuggestions} from "@/lib/dailyWorkFollowUpView";

function dayKey(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}

export default async function AdvisorDailyWorkPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(me?.role!=="advisor"||me?.system_role==="admin")redirect(me?.system_role==="admin"?"/system-admin":"/dashboard");
 const[{data:tasks},{data:inspections},{data:reports},{data:recentInspections}]=await Promise.all([
  supabase.from("tasks").select("id,title,due_date,priority,status,review_status,completed_at,farm_id,field_id,created_at").neq("status","done").limit(500),
  supabase.from("inspections").select("id,field_id,condition,next_check_at,inspected_at,issue_status").neq("issue_status","resolved").limit(500),
  supabase.from("farmer_reports").select("id,title,status,field_id,created_at").neq("status","closed").limit(300),
  supabase.from("inspections").select("id,field_id,condition,inspected_at").order("inspected_at",{ascending:false}).limit(100)
 ]);
 const items:DailyWorkInput[]=[
  ...(tasks??[]).map(t=>({id:t.id,kind:"task" as const,title:t.title,dueAt:t.due_date,createdAt:t.created_at,priority:t.priority,status:t.status,farmId:t.farm_id,fieldId:t.field_id})),
  ...(inspections??[]).map(i=>({id:i.id,kind:"inspection" as const,title:i.condition==="critical"?"Kritikus táblaállapot":"Szemle / visszaellenőrzés",dueAt:i.next_check_at,createdAt:i.inspected_at,condition:i.condition,status:i.issue_status,fieldId:i.field_id})),
  ...(reports??[]).map(r=>({id:r.id,kind:"report" as const,title:r.title,dueAt:null,createdAt:r.created_at,status:r.status,unread:true,fieldId:r.field_id}))
 ];
 const prioritized=prioritizeDailyWork(items),alerts=buildDailyAlerts(items,dayKey());
 const lifecycleTasks=(tasks??[]).map(t=>({id:t.id,title:t.title,status:t.status,reviewStatus:t.review_status,completedAt:t.completed_at,fieldId:t.field_id,dueDate:t.due_date}));
 const followUps=buildFollowUpSuggestions((recentInspections??[]).map(i=>({id:i.id,source:"inspection" as const,title:"Szemle",completedAt:i.inspected_at,condition:i.condition,fieldId:i.field_id})));
 return <main className="admin-shell">
  <header className="admin-header"><div><span className="eyebrow">NAPI MUNKAVÉGZÉS 2.0</span><h1>Szaktanácsadói napi vezérlő</h1><p>{me.full_name||"Szaktanácsadó"} · a teljes ügyfélállomány sürgős munkái egységes prioritási motorral.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><DailyWorkLegend/><Link className="ghost-btn" href="/admin/workday">Heti munkanap →</Link></div></header>
  <AdminNav active="workday"/>
  <DailyWorkSummary items={prioritized}/>
  <DailyAlertStrip alerts={alerts}/>
  <TaskLifecycleBoard tasks={lifecycleTasks} scope="advisor"/>
  <FollowUpSuggestionBoard items={followUps}/>
  <DailyPriorityBoard items={items} title="Mai szaktanácsadói prioritások" scope="advisor"/>
  <section className="panel"><div className="panel-heading"><div><span className="eyebrow">FELELŐSSÉGI HATÁR</span><h2>Döntéstámogatás, nem automatikus döntés</h2></div></div><div style={{padding:14,lineHeight:1.65}}><p>A pontszám a határidőt, prioritást, kritikus állapotot, új gazdálkodói jelzést és szükséges visszaellenőrzést súlyozza.</p><p style={{marginBottom:0}}><strong>A szaktanácsadó szakmai sorrendet állít fel.</strong> A rendszer nem ad gazdasági növényvédelmi jóváhagyási jogot, nem hajt végre műveletet és nem zár le feladatot automatikusan.</p></div></section>
 </main>;
}
