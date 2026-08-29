import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");
 if(profile?.role==="advisor")redirect("/admin");
 return children;
}
