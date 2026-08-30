"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {LogoutButton} from "@/components/LogoutButton";
import {ComprehensiveTour,ComprehensiveTourRestart} from "@/components/ComprehensiveTour";
import styles from "./SystemAdminSidebar.module.css";

const items=[
 ["/system-admin","⌂","Rendszeráttekintés","admin-home"],
 ["/system-admin/support","⌘","Támogatási központ","admin-support"],
 ["/system-admin/users","♙","Felhasználók","admin-users"],
 ["/system-admin/security","⚠","Biztonsági események","admin-security"],
 ["/system-admin/backup","▤","Biztonsági mentés","admin-backup"],
] as const;

export function SystemAdminSidebar(){
 const pathname=usePathname();const[open,setOpen]=useState(false);
 return <><ComprehensiveTour role="system-admin"/><button className={styles.launch} type="button" onClick={()=>setOpen(true)} aria-label="Admin menü megnyitása"><span/><span/><span/></button>{open&&<button className={styles.overlay} onClick={()=>setOpen(false)} aria-label="Oldalsáv bezárása"/>}<aside className={`${styles.sidebar} ${open?styles.open:""}`}><div className={styles.brand}><span className={styles.shield}>AM</span><div><strong>AGRÁR MENTOR</strong><small>RENDSZERADMINISZTRÁTOR</small></div><button className={styles.close} type="button" onClick={()=>setOpen(false)} aria-label="Oldalsáv bezárása"><span/><span/><span/></button></div><div className={styles.warning}>ADMIN MÓD<br/><small>Minden beavatkozás naplózható.</small></div><nav className={styles.nav}>{items.map(([href,icon,label,tour])=>{const active=href==="/system-admin"?pathname===href:pathname.startsWith(href);return <Link data-admin-tour={tour} onClick={()=>setOpen(false)} key={href} className={active?styles.active:""} href={href}><span>{icon}</span><b>{label}</b></Link>})}</nav><div className={styles.help}><strong>Támogatási szabály</strong><small>Admin beavatkozás csak indokkal történjen. Kritikus műveletnél friss MFA szükséges.</small><ComprehensiveTourRestart role="system-admin"/></div><div className={styles.account}><div className={styles.user}><span className={styles.avatar}>RA</span><div><strong>Rendszeradmin</strong><small>Emelt jogosultság</small></div></div><LogoutButton className={styles.logout}/></div></aside></>}
