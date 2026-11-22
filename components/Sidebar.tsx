"use client";
import Link from "next/link";
import {useState} from "react";
import {ComprehensiveTour,ComprehensiveTourRestart} from "@/components/ComprehensiveTour";
import {ProcessGuideButton,ProcessGuideProvider} from "@/components/ProcessGuide";
import {HelpCenter} from "@/components/HelpCenter";
import {AgrarMentorLogo} from "@/components/AgrarMentorLogo";
import styles from "./FarmerSidebar.module.css";

const primary=[
 ["/dashboard","dashboard","⌂","Áttekintés","farmer-dashboard"],
 ["/daily-work","daily-work","★","Mai prioritások","farmer-daily-work"],
 ["/fields","fields","◩","Táblák","farmer-fields"],
 ["/operations","operations","✣","Műveleti napló","farmer-operations"],
 ["/operations/approvals","approvals","✓","Jóváhagyások","farmer-approvals"],
 ["/tasks","tasks","☑","Teendők","farmer-tasks"],
 ["/messages","messages","✉","Üzenetek","farmer-messages"],
 ["/documents","documents","□","Dokumentumok","farmer-documents"]
] as const;
const secondary=[
 ["/farms","farms","▥","Gazdaságom","farmer-farms"],
 ["/map","map","⌖","Térkép","farmer-map"],
 ["/team","team","♙","Munkatársak","farmer-team"],
 ["/dispatch","dispatch","↗","Munkakiosztás","farmer-dispatch"],
 ["/machines","machines","⚙","Géppark","farmer-machines"],
 ["/timeline","timeline","☼","Idővonal","farmer-timeline"],
 ["/invoices","invoices","▤","Számlák","farmer-invoices"],
 ["/profit","profit","▥","Jövedelmezőség","farmer-profit"],
 ["/notifications","notifications","●","Értesítések","farmer-notifications"]
] as const;

export function Sidebar({active="dashboard",userName="Gazdálkodó"}:{active?:string;userName?:string}){
 const[open,setOpen]=useState(false);
 const row=([href,key,icon,label,tour]:typeof primary[number]|typeof secondary[number])=><Link data-tour={tour} onClick={()=>setOpen(false)} key={key} className={active===key?styles.active:""} href={href}><span className={styles.icon}>{icon}</span><span>{label}</span></Link>;
 return <><ComprehensiveTour role="farmer"/><ProcessGuideProvider/><HelpCenter role="farmer"/>
  <button className={styles.launch} type="button" aria-label="Menü megnyitása" aria-expanded={open} aria-controls="farmer-navigation-drawer" onClick={()=>setOpen(true)}><span/><span/><span/></button>
  {open&&<button className={styles.overlay} type="button" aria-label="Oldalsáv bezárása" onClick={()=>setOpen(false)}/>}
  <aside id="farmer-navigation-drawer" className={`${styles.sidebar} ${open?styles.open:""}`} onKeyDown={event=>{if(event.key==="Escape")setOpen(false)}}>
   <div className={styles.brand}><div className={styles.brandText}><AgrarMentorLogo className={styles.brandLogo} priority/><small>GAZDÁLKODÓI PORTÁL</small></div><button className={styles.close} type="button" aria-label="Oldalsáv bezárása" onClick={()=>setOpen(false)}><span/><span/><span/></button></div>
   <nav className={styles.nav} aria-label="Gazdálkodói menü">
    <div className={styles.primaryList}>{primary.map(row)}</div>
    <div className={styles.sectionLabel}>GAZDASÁGOM</div>
    <div className={styles.secondaryList}>{secondary.map(row)}</div>
   </nav>
   <div className={styles.promo}><span>◒</span><strong>Hatékonyabb gazdálkodás<br/>egy fenntarthatóbb<br/>jövőért.</strong></div>
   <div className={styles.help}><strong>Segítség</strong><small>Gyors elérés az útmutatóhoz és a szakmai kapcsolathoz.</small><button type="button" onClick={()=>{setOpen(false);window.dispatchEvent(new Event("agrar-help-center-open"))}}>Súgóközpont</button><Link onClick={()=>setOpen(false)} href="/messages">Kapcsolat</Link><ComprehensiveTourRestart role="farmer"/>{active==="operations"&&<ProcessGuideButton guide="create-operation" label="ⓘ Művelet rögzítése – mezőről mezőre"/>}{active==="team"&&<ProcessGuideButton guide="invite-member" label="ⓘ Munkatárs meghívása – mezőről mezőre"/>}{active==="machines"&&<ProcessGuideButton guide="create-machine" label="ⓘ Gép felvétele – mezőről mezőre"/>}{active==="dispatch"&&<ProcessGuideButton guide="dispatch-work" label="ⓘ Munka kiosztása – mezőről mezőre"/>}</div>
   <div className={styles.landscape} aria-hidden="true"/>
   <Link className={styles.userFooter} href="/profile" onClick={()=>setOpen(false)} aria-label={`${userName} – profil megnyitása`}>
    <span className={styles.userFooterAvatar}>{userName.trim().slice(0,1).toLocaleUpperCase("hu-HU")||"G"}</span>
    <span><strong>{userName}</strong><small>Profil és fiókbeállítások</small></span>
   </Link>
  </aside>
 </>;
}
