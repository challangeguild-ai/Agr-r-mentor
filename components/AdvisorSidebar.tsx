"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {LogoutButton} from "@/components/LogoutButton";
import styles from "./AdvisorSidebar.module.css";

const items=[
  ["/admin","⌂","Kezdőlap"],
  ["/admin/clients","♙","Ügyfelek"],
  ["/admin/workday","◷","Munkanap"],
  ["/admin/operations","▤","Műveletek"],
  ["/admin/plant-protection-import","✦","Növényvédelem"],
  ["/admin/map","⌖","Térkép"],
  ["/admin/documents","□","Dokumentumok"],
] as const;

export function AdvisorSidebar(){
  const pathname=usePathname();
  const[open,setOpen]=useState(false);
  return <>
    <button className={styles.launch} type="button" onClick={()=>setOpen(true)} aria-label="Menü megnyitása"><span/><span/><span/></button>
    {open&&<button className={styles.overlay} type="button" onClick={()=>setOpen(false)} aria-label="Menü bezárása"/>}
    <aside className={`${styles.sidebar} ${open?styles.open:""}`}>
      <div className={styles.brand}>
        <span className={styles.leaf}>◒</span>
        <div><strong>AGRÁR MENTOR</strong><small>SZAKTANÁCSADÓI PORTÁL</small></div>
        <button className={styles.close} type="button" onClick={()=>setOpen(false)} aria-label="Menü bezárása"><span/><span/><span/></button>
      </div>
      <nav className={styles.nav}>{items.map(([href,icon,label])=>{const active=href==="/admin"?pathname===href:pathname.startsWith(href);return <Link onClick={()=>setOpen(false)} key={href} className={active?styles.active:""} href={href}><span>{icon}</span><b>{label}</b></Link>})}</nav>
      <div className={styles.help}><strong>Szaktanácsadói szerep</strong><small>Szakmai javaslatot adhatsz és a gazdaság műveleti naplóját követheted. A kijuttatási jóváhagyás a gazdaság saját jogosult személyének feladata.</small><Link onClick={()=>setOpen(false)} href="/admin/workday">Munkanap megnyitása</Link></div>
      <div className={styles.account}><div className={styles.user}><span className={styles.avatar}>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div><LogoutButton className={styles.logout}/></div>
    </aside>
  </>
}
