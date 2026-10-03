import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {BlockHelpButton} from "@/components/GuidedTour";
import styles from "./system-admin-dashboard.module.css";

export default async function SystemAdminPage(){
 const supabase=createAdminClient();
 const[{count:users},{count:farms},{count:fields},{count:tasks},{count:openTasks},{count:reports},{count:securityHigh},{data:recentAudit}]=await Promise.all([
  supabase.from("profiles").select("id",{count:"exact",head:true}),
  supabase.from("farms").select("id",{count:"exact",head:true}),
  supabase.from("fields").select("id",{count:"exact",head:true}),
  supabase.from("tasks").select("id",{count:"exact",head:true}),
  supabase.from("tasks").select("id",{count:"exact",head:true}).neq("status","done"),
  supabase.from("farmer_reports").select("id",{count:"exact",head:true}).neq("status","closed"),
  supabase.from("security_events").select("id",{count:"exact",head:true}).gte("risk_score",70),
  supabase.from("admin_audit_events").select("id,created_at,action,target_type,target_id,reason").order("created_at",{ascending:false}).limit(8)
 ]);
 const cards=[
  ["Felhasználók",users??0,"/system-admin/users","Gazdák, szaktanácsadók és rendszerjogok","♙"],
  ["Gazdaságok",farms??0,"/system-admin/support","Teljes támogatási és hibajavítási nézet","▥"],
  ["Földtáblák",fields??0,"/system-admin/support","Rendszerszintű adatok támogatási nézetben","◇"],
  ["Nyitott feladatok",openTasks??0,"/system-admin/support","Elakadt munkafolyamatok vizsgálata","☑"],
  ["Nyitott jelzések",reports??0,"/system-admin/support","Támogatási célú rendszeráttekintés","✉"],
  ["Magas kockázat",securityHigh??0,"/system-admin/security","Biztonsági események ellenőrzése","⚠"]
 ] as const;
 const attention=(openTasks??0)+(reports??0)+(securityHigh??0);
 return <main className={styles.page}>
  <header className={styles.topbar}>
   <div><span className={styles.eyebrow}>RENDSZERADMINISZTRÁTORI PORTÁL</span><h1>Agrár Mentor rendszerfelügyelet</h1><p>Üzemeltetés, támogatás, incidensvizsgálat és auditált adminisztrátori beavatkozás.</p></div>
   <div className={styles.topActions}><BlockHelpButton label="A rendszeráttekintés magyarázata" content={{title:"Rendszerszintű áttekintés",body:"A rendszeradmin felület üzemeltetési és támogatási munkatér. A kártyák a teljes rendszer fő terhelési és biztonsági jelzéseit foglalják össze.",important:"A rendszeradmin szerepkör nem szakmai gazdálkodási döntési felület."}}/><span className={styles.adminMode}>ADMIN MÓD</span></div>
  </header>

  <section className={styles.hero}>
   <div><span>RENDSZERÁLLAPOT</span><h2><strong>{attention}</strong> ügy igényel rendszeradminisztrátori figyelmet</h2><p>{openTasks??0} nyitott feladat · {reports??0} nyitott jelzés · {securityHigh??0} magas kockázatú esemény</p></div>
   <Link href="/system-admin/security">Biztonsági központ →</Link>
  </section>

  <section className={styles.summaryGrid}>
   {cards.slice(0,3).map(([label,count,href,,icon])=><Link href={href} key={label} className={styles.summaryCard}><span>{icon}</span><div><small>{label}</small><strong>{count}</strong></div><b>›</b></Link>)}
  </section>

  <section className={styles.controlGrid} data-help-block="system-control-cards">
   <div className={styles.sectionHead}><div><span>RENDSZERFELÜGYELET</span><h2>Admin munkaterületek</h2></div><BlockHelpButton label="A rendszerfelügyeleti kártyák magyarázata" content={{title:"Rendszerfelügyeleti területek",body:"A kártyák a fő admin munkaterületekre vezetnek: felhasználók, támogatás, biztonság és elakadt folyamatok.",important:"A magas kockázati szám incidensvizsgálati jelzés; önmagában nem bizonyít jogosulatlan hozzáférést."}}/></div>
   <div className={styles.cards}>{cards.map(([label,count,href,meta,icon])=><Link key={label} href={href} className={styles.controlCard}><span className={styles.cardIcon}>{icon}</span><div><strong>{label}</strong><small>{meta}</small></div><em>{count}</em><b>→</b></Link>)}</div>
  </section>

  <section className={styles.auditPanel} data-help-block="system-audit">
   <div className={styles.sectionHead}><div><span>AUDIT</span><h2>Legutóbbi admin beavatkozások</h2></div><div className={styles.auditTools}><span>Összes feladat: {tasks??0}</span><BlockHelpButton label="Az admin auditnapló magyarázata" content={{title:"Adminisztrátori auditnapló",body:"A legutóbbi rendszeradminisztrátori beavatkozások visszakövethető listája: művelet, érintett objektum, időpont és indoklás.",important:"Kritikus beavatkozásnál az indoklásnak konkrétnak és ellenőrizhetőnek kell lennie."}}/></div></div>
   {recentAudit?.length?<div className={styles.auditList}>{recentAudit.map(e=><article key={e.id}><span className={styles.auditDot}/><div><strong>{e.action}</strong><small>{e.target_type}{e.target_id?` · ${e.target_id}`:""} · {new Date(e.created_at).toLocaleString("hu-HU")}</small><p>{e.reason}</p></div></article>)}</div>:<div className={styles.empty}>Még nincs adminisztrátori beavatkozás naplózva.</div>}
  </section>
 </main>;
}
