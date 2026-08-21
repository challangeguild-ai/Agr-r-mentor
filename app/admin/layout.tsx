import {ReactNode} from "react";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdvisorSidebar} from "@/components/AdvisorSidebar";
import styles from "./AdminLayout.module.css";

export default async function AdminLayout({children}:{children:ReactNode}){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")redirect("/dashboard");
  return <div className={styles.app}><AdvisorSidebar/><section className={styles.content}>{children}</section></div>
}
