"use client";
import Link from "next/link";
import {useState} from "react";
import {LogoutButton} from "@/components/LogoutButton";
import {GuidedTour,TourRestartButton} from "@/components/GuidedTour";
import {ProcessGuideButton,ProcessGuideProvider} from "@/components/ProcessGuide";
import styles from "./FarmerSidebar.module.css";

const primary=[
  ["/dashboard","dashboard","⌂","Áttekintés","farmer-dashboard"],
  ["/fields","fields","◩","Táblák","farmer-fields"],
  ["/operations","operations","✣","Műveleti napló","farmer-operations"],
  ["/operations/approvals","approvals","✓","Jóváhagyások","farmer-approvals"],
  ["/tasks","tasks","☑","Teendők","farmer-tasks"],
  ["/messages","messages","✉","Üzenetek","farmer-messages"],
  ["/documents","documents","□","Dokumentumok","farmer-documents"],
] as const;
const secondary=[
  ["/farms","farms","▥","Gazdaságom","farmer-farms"],
  ["/map","map","⌖","Térkép","farmer-map"],
  ["/team","team","♙","Munkatársak","farmer-team"],
  ["/dispatch","dispatch","↗","Munkakiosztás","farmer-dispatch"],
  ["/machines","machines","⚙","Géppark","farmer-machines"],
  ["/timeline","timeline","☼","Idővonal","farmer-timeline"],
  ["/invoices","invoices","▤","Számlák","farmer-invoices"],
  ["/notifications","notifications","●","Értesítések","farmer-notifications"],
] as const;

export function Sidebar({active="dashboard",userName="Gazdálkodó"}:{active?:string;userName?:string}){
  const[open,setOpen]=useState(false);const initials=userName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"G";
  const row=([href,key,icon,label,tour]:typeof primary[number]|typeof secondary[number])=><Link data-tour={tour} onClick={()=>setOpen(false)} key={key} className={active===key?styles.active:""} href={href}><span className={styles.icon}>{icon}</span><span>{label}</span></Link>;
  return <><GuidedTour role="farmer"/><ProcessGuideProvider/><button className={styles.launch} type="button" aria-label="Menü megnyitása" onClick={()=>setOpen(true)}><span/><span/><span/></button>{open&&<button className={styles.overlay} aria-label="Menü bezárása" onClick={()=>setOpen(false)}/>}<aside className={`${styles.sidebar} ${open?styles.open:""}`}><div className={styles.brand}><span className={styles.leaf}>◒</span><div className={styles.brandText}><strong>AGRÁR MENTOR</strong><small>GAZDÁLKODÓI PORTÁL</small></div><button className={styles.close} type="button" aria-label="Menü bezárása" onClick={()=>setOpen(false)}><span/><span/><span/></button></div><nav className={styles.nav}>{primary.map(row)}<details className={styles.more} open={secondary.some(([,key])=>key===active)}><summary>További funkciók</summary><div className={styles.moreList}>{secondary.map(row)}</div></details></nav><div className={styles.help}><strong>Kérdése van?</strong><small>Írjon a szaktanácsadójának.</small><Link onClick={()=>setOpen(false)} href="/messages">Kapcsolatfelvétel</Link><TourRestartButton role="farmer"/><ProcessGuideButton guide="create-operation" label="Művelet rögzítése – részletes útmutató"/></div><div className={styles.bottom}><div className={styles.user}><span className={styles.avatar}>{initials}</span><div><strong>{userName}</strong><small>Gazdálkodó</small></div></div><LogoutButton className={styles.logout}/><small className={styles.version}>Agrár Mentor</small></div></aside></>;
}
