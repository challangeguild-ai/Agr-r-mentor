import {ReactNode} from "react";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {SystemAdminSidebar} from "@/components/SystemAdminSidebar";
import styles from "./SystemAdminLayout.module.css";

export const dynamic="force-dynamic";

export default async function SystemAdminLayout({children}:{children:ReactNode}){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")redirect(`/mfa?next=${encodeURIComponent("/system-admin")}`);
 const{data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor"||profile?.system_role!=="admin")redirect(profile?.role==="advisor"?"/admin":"/dashboard");
 return <div className={styles.app}><SystemAdminSidebar/><section className={styles.content}>{children}</section></div>
}
