"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {LogoutButton} from "@/components/LogoutButton";

const items=[
  ["/admin","⌂","Áttekintés"],
  ["/admin/clients","♙","Ügyfelek"],
  ["/admin/reports","✉","Bejelentések"],
  ["/admin/inspections","⌖","Szemlék"],
  ["/admin/tasks","☑","Teendők"],
  ["/admin/timeline","☼","Idővonal"],
  ["/admin/documents","□","Dokumentumok"],
] as const;

export function AdvisorSidebar(){
  const pathname=usePathname();
  const[open,setOpen]=useState(false);
  return <>
    <button className="advisor-drawer-trigger" type="button" onClick={()=>setOpen(true)} aria-label="Menü megnyitása"><span/><span/><span/></button>
    <button className={`advisor-drawer-backdrop ${open?"show":""}`} type="button" onClick={()=>setOpen(false)} aria-label="Menü bezárása"/>
    <aside className={`advisor-sidebar advisor-sidebar-reference ${open?"drawer-open":""}`}>
      <div className="advisor-reference-brand">
        <span className="advisor-reference-leaf">◒</span>
        <div><strong>AGRÁR MENTOR</strong><small>SZAKTANÁCSADÓI PORTÁL</small></div>
        <button className="advisor-drawer-close" type="button" onClick={()=>setOpen(false)} aria-label="Menü bezárása">×</button>
      </div>
      <nav className="advisor-reference-nav">{items.map(([href,icon,label])=>{const active=href==="/admin"?pathname===href:pathname.startsWith(href);return <Link onClick={()=>setOpen(false)} key={href} className={active?"active":""} href={href}><span>{icon}</span><b>{label}</b></Link>})}</nav>
      <div className="advisor-reference-help"><strong>Kérdése vagy új feladata van?</strong><small>Ügyfél, szemle vagy teendő rögzítése néhány kattintással.</small><Link href="/admin/tasks">Teendő kiadása</Link></div>
      <div className="advisor-reference-account"><div className="advisor-reference-user"><span>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div><LogoutButton className="advisor-reference-logout"/></div>
    </aside>
  </>
}
