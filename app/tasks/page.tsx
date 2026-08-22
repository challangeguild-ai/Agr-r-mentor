import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import {TaskProofCompleteForm} from "@/components/TaskProofCompleteForm";
import {TASK_PROOF_EVENT,decodeTaskProof} from "@/lib/taskProof";
import styles from "./tasks.module.css";

type SearchParams = Promise<{ view?: string }>;

function dateKey(date = new Date()) {return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)}
function addDaysKey(days:number){const d=new Date();d.setDate(d.getDate()+days);return dateKey(d)}
function formatDate(value: string | null) {if (!value) return "Nincs határidő";return new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest" }).format(new Date(`${value}T12:00:00`))}
function priorityLabel(priority: string) {if (priority === "urgent") return "Sürgős";if (priority === "high") return "Fontos";return "Normál"}

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "open" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  let query = supabase.from("tasks").select("id,title,description,due_date,priority,status,completed_at,field_id,farm_id,assigned_to,created_at").order("due_date", { ascending: true, nullsFirst: false });
  if (profile?.role !== "advisor") query = query.eq("assigned_to", user.id);
  const { data: tasks, error } = await query;if (error) throw new Error(error.message);
  const fieldIds = [...new Set((tasks ?? []).map(task => task.field_id).filter(Boolean))] as string[];
  const farmIds = [...new Set((tasks ?? []).map(task => task.farm_id).filter(Boolean))] as string[];
  const [{ data: fields }, { data: farms },{data:proofEvents}] = await Promise.all([
    fieldIds.length ? supabase.from("fields").select("id,name").in("id", fieldIds) : Promise.resolve({ data: [] }),
    farmIds.length ? supabase.from("farms").select("id,name").in("id", farmIds) : Promise.resolve({ data: [] }),
    (tasks?.length??0)?supabase.from("timeline_events").select("source_id,description,event_at,created_by").eq("event_type",TASK_PROOF_EVENT).in("source_id",(tasks??[]).map(t=>t.id)):Promise.resolve({data:[]})
  ]);
  const proofMap=new Map((proofEvents??[]).map(e=>[e.source_id,{...e,proof:decodeTaskProof(e.description)}]));
  const today = dateKey();const weekEnd = addDaysKey(7);const open = (tasks ?? []).filter(task => task.status !== "done");const overdue = open.filter(task => task.due_date && task.due_date < today);const dueToday = open.filter(task => task.due_date === today);const upcoming = open.filter(task => task.due_date && task.due_date > today && task.due_date <= weekEnd);const done = (tasks ?? []).filter(task => task.status === "done");
  const visible = (tasks ?? []).filter(task => {if (view === "overdue") return task.status !== "done" && !!task.due_date && task.due_date < today;if (view === "upcoming") return task.status !== "done" && !!task.due_date && task.due_date > today && task.due_date <= weekEnd;if (view === "done") return task.status === "done";if (view === "all") return true;return task.status !== "done"});

  return <div className="app-shell farmer-app"><Sidebar active="tasks" /><main className="dashboard"><header className="topbar"><div><span className="eyebrow">MUNKALISTA</span><h1>Teendők</h1><p>Minden kiadott feladat, határidő és elvégzett munka egy helyen.</p></div><div className="user-pill">{profile?.role === "advisor" ? "Szaktanácsadó" : "Gazdálkodó"}</div></header>
  <section className="stats-grid"><article className="stat-card"><span>Nyitott</span><strong>{open.length}</strong><small>Elvégzésre vár</small></article><article className="stat-card"><span>Lejárt</span><strong className={overdue.length ? styles.dangerNumber : ""}>{overdue.length}</strong><small>Határidőn túl</small></article><article className="stat-card"><span>Következő 7 nap</span><strong>{upcoming.length}</strong><small>{dueToday.length ? `${dueToday.length} ma esedékes` : "Közelgő feladatok"}</small></article><article className="stat-card"><span>GPS-validált</span><strong>{done.filter(t=>proofMap.has(t.id)).length}</strong><small>fotóval igazolt munka</small></article></section>
  <section className="panel"><div className={styles.tabs}><Link className={view === "open" ? styles.active : ""} href="/tasks?view=open">Nyitott <span>{open.length}</span></Link><Link className={view === "overdue" ? styles.active : ""} href="/tasks?view=overdue">Lejárt <span>{overdue.length}</span></Link><Link className={view === "upcoming" ? styles.active : ""} href="/tasks?view=upcoming">7 napon belül <span>{upcoming.length}</span></Link><Link className={view === "done" ? styles.active : ""} href="/tasks?view=done">Elvégzett <span>{done.length}</span></Link><Link className={view === "all" ? styles.active : ""} href="/tasks?view=all">Összes <span>{tasks?.length ?? 0}</span></Link></div>
  {visible.length ? <div className={styles.list}>{visible.map(task => {const field = fields?.find(item => item.id === task.field_id);const farm = farms?.find(item => item.id === task.farm_id);const isOverdue = task.status !== "done" && !!task.due_date && task.due_date < today;const isToday = task.status !== "done" && task.due_date === today;const proof=proofMap.get(task.id)?.proof;return <article className={`${styles.card} ${isOverdue ? styles.overdue : ""}`} key={task.id}><div className={styles.main}><div className={styles.title}><span className={`dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{field?.name || farm?.name || "Gazdasági teendő"}</small></div></div>{task.description && <p>{task.description}</p>}<div className={styles.meta}><span className={`${styles.priority} ${task.priority === "urgent" ? styles.urgent : task.priority === "high" ? styles.high : ""}`}>{priorityLabel(task.priority)}</span><span className={isOverdue ? styles.overdueText : isToday ? styles.todayText : styles.deadline}>{task.status === "done" ? `Elvégezve: ${task.completed_at ? new Date(task.completed_at).toLocaleDateString("hu-HU") : "—"}` : `${isOverdue ? "Lejárt: " : isToday ? "Ma esedékes: " : "Határidő: "}${formatDate(task.due_date)}`}</span>{proof&&<span style={{fontSize:11,fontWeight:800,color:"#34753a"}}>✓ GPS + fotó igazolva · ±{Math.round(proof.accuracy)} m</span>}</div></div><div className={styles.actions}>{task.field_id && <Link className="ghost-btn" href={`/fields/${task.field_id}`}>Tábla megnyitása</Link>}{profile?.role !== "advisor" && task.status !== "done" && task.field_id && <TaskProofCompleteForm taskId={task.id}/>} {profile?.role !== "advisor" && task.status !== "done" && !task.field_id && <small>Az igazolt lezáráshoz a teendőt földtáblához kell kapcsolni.</small>}{task.status === "done" && <span className={styles.done}>{proof?"✓ GPS-validált":"✓ Elvégezve"}</span>}</div></article>})}</div> : <div className="empty-state">Ebben a nézetben nincs teendő.</div>}</section></main></div>;
}
