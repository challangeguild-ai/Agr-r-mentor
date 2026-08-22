import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {AdminNav} from "@/components/AdminNav";
import {NotificationCenter} from "./NotificationCenter";
import styles from "./notifications.module.css";
export default async function NotificationsPage(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();const{data:items,error}=await supabase.from("notifications").select("id,kind,title,message,href,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);if(error)throw new Error(error.message);const content=<div className={styles.page}><header className={styles.head}><div><span className="eyebrow">ÉRTESÍTÉSI KÖZPONT</span><h1>Értesítések</h1><p>Szemlék, teendők, válaszok és fontos gazdasági események egy helyen.</p></div></header><NotificationCenter items={items??[]}/></div>;if(profile?.role==="advisor")return <main className="admin-shell"><AdminNav active="notifications"/>{content}</main>;return <div className="app-shell farmer-app"><Sidebar active="notifications" userName={profile?.full_name||"Gazdálkodó"}/><main className="dashboard">{content}</main></div>}
