import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {AdvisorSidebar} from "@/components/AdvisorSidebar";
import {SystemAdminSidebar} from "@/components/SystemAdminSidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {ProfileEditor} from "@/components/ProfileEditor";
import {BlockHelpButton} from "@/components/GuidedTour";
import styles from "./profile.module.css";

export default async function ProfilePage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name,phone,avatar_url,city,job_title").eq("id",user.id).maybeSingle();
 const{data:license}=await supabase.from("profile_plant_protection_licenses").select("authorization_level,permit_number,valid_until,active").eq("user_id",user.id).maybeSingle();
 const name=profile?.full_name||"Gazdálkodó";
 const theme=profile?.system_role==="admin"?"red":profile?.role==="advisor"?"blue":"green";
 const sidebar=theme==="red"?<SystemAdminSidebar/>:theme==="blue"?<AdvisorSidebar/>:<Sidebar active="" userName={name}/>;
 return <div className={`app-shell farmer-app ${styles[theme]}`}>{sidebar}<main className="dashboard">
  <FarmerTopbar userName={name}/>
  <header className={styles.head}><div><span>SAJÁT PROFIL</span><h1>Profil és megjelenés</h1><p>A fejlécben és a gazdasági munkafolyamatokban használt személyes adatok.</p></div><BlockHelpButton label="A profilbeállítások magyarázata" content={{title:"Saját profil",body:"A név és a profilkép a gazdálkodói fejlécben, a profilmenüben és ahol releváns, a közös munkafolyamatokban jelenik meg.",important:"Csak saját profiladatot módosíts. A gazdasági szerepkör és jogosultság nem ezen az oldalon változik.",steps:["Ellenőrizd a teljes neved.","Szükség esetén adj meg telefonszámot.","Tölts fel profilképet.","Mentsd a profilt.","A fejléc frissítés után azonnal az új adatokat mutatja."]}}/></header>
  <section className={styles.card}><ProfileEditor userId={user.id} email={user.email||""} fullName={name} phone={profile?.phone||""} city={profile?.city||""} jobTitle={profile?.job_title||""} avatarUrl={profile?.avatar_url||null} license={license||null}/></section>
 </main></div>
}
