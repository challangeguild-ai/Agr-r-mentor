import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {ProfileEditor} from "@/components/ProfileEditor";
import {BlockHelpButton} from "@/components/GuidedTour";
import styles from "./profile.module.css";

export default async function ProfilePage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name,phone,avatar_url").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin");
 const name=profile?.full_name||"Gazdálkodó";
 return <div className="app-shell farmer-app"><Sidebar active="" userName={name}/><main className="dashboard">
  <FarmerTopbar userName={name}/>
  <header className={styles.head}><div><span>SAJÁT PROFIL</span><h1>Profil és megjelenés</h1><p>A fejlécben és a gazdasági munkafolyamatokban használt személyes adatok.</p></div><BlockHelpButton label="A profilbeállítások magyarázata" content={{title:"Saját profil",body:"A név és a profilkép a gazdálkodói fejlécben, a profilmenüben és ahol releváns, a közös munkafolyamatokban jelenik meg.",important:"Csak saját profiladatot módosíts. A gazdasági szerepkör és jogosultság nem ezen az oldalon változik.",steps:["Ellenőrizd a teljes neved.","Szükség esetén adj meg telefonszámot.","Tölts fel profilképet.","Mentsd a profilt.","A fejléc frissítés után azonnal az új adatokat mutatja."]}}/></header>
  <section className={styles.card}><ProfileEditor userId={user.id} fullName={name} phone={profile?.phone||""} avatarUrl={profile?.avatar_url||null}/></section>
 </main></div>
}
