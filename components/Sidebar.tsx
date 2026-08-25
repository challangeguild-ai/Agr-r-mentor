"use client";
import Link from "next/link";
import {useState} from "react";
import {LogoutButton} from "@/components/LogoutButton";
import styles from "./FarmerSidebar.module.css";

const primary=[
  ["/dashboard","dashboard","⌂","Áttekintés"],
  ["/fields","fields","◩","Táblák"],
  ["/operations","operations","✣","Műveleti napló"],
  ["/operations/approvals","approvals","✓","Jóváhagyások"],
  ["/tasks","tasks","☑","Teendők"],
  ["/messages","messages","✉","Üzenetek"],
  ["/documents","documents","□","Dokumentumok"],
] as const;
const secondary=[
  ["/farms","farms","▥","Gazdaságom"],
  ["/map","map","⌖","Térkép"],
  ["/team","team","♙","Munkatársak"],
  ["/dispatch","dispatch","↗","Munkakiosztás"],
  ["/machines","machines","⚙","Géppark"],
  ["/timeline","timeline","☼","Idővonal"],
  ["/invoices","invoices","▤","Számlák"],
  ["/notifications","notifications","●","Értesítések"],
] as const;

export function Sidebar({active="dashboard",userName="Gazdálkodó"}:{active?:string;userName?:string}){
  const[open,setOpen]=useState(false);const initials=userName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"G";
  const row=([href,key,icon,label]:typeof primary[number]|typeof secondary[number])=><Link onClick={()=>setOpen(false)} key={key} className={active===key?styles.active:""} href={href}><span className={styles.icon}>{icon}</span><span>{label}</span></Link>;
  return <><button className={styles.launch} type="button" aria-label="Menü megnyitása" onClick={()=>setOpen(true)}><span/><span/><span/></button>{open&&<button className={styles.overlay} aria-label="Menü bezárása" onClick={()=>setOpen(false)}/>}<aside className={`${styles.sidebar} ${open?styles.open:""}`}><div className={styles.brand}><span className={styles.leaf}>◒</span><div className={styles.brandText}><strong>AGRÁR MENTOR</strong><small>GAZDÁLKODÓI PORTÁL</small></div><button className={styles.close} type="button" aria-label="Menü bezárása" onClick={()=>setOpen(false)}><span/><span/><span/></button></div><nav className={styles.nav}>{primary.map(row)}<details className={styles.more} open={secondary.some(([,key])=>key===active)}><summary>További funkciók</summary><div className={styles.moreList}>{secondary.map(row)}</div></details></nav><div className={styles.help}><strong>Kérdése van?</strong><small>Írjon a szaktanácsadójának.</small><Link onClick={()=>setOpen(false)} href="/messages">Kapcsolatfelvétel</Link></div><div className={styles.bottom}><div className={styles.user}><span className={styles.avatar}>{initials}</span><div><strong>{userName}</strong><small>Gazdálkodó</small></div></div><LogoutButton className={styles.logout}/><small className={styles.version}>Agrár Mentor</small></div></aside></>;
}
