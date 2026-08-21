import {ReactNode} from "react";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdvisorSidebar} from "@/components/AdvisorSidebar";

export default async function AdminLayout({children}:{children:ReactNode}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")redirect("/dashboard");return <div className="advisor-app"><AdvisorSidebar/><section className="advisor-content">{children}</section></div>}
