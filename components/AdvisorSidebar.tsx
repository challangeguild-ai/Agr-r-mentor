"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
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
  return <aside className="advisor-sidebar advisor-sidebar-reference">
    <div className="advisor-reference-brand"><span className="advisor-reference-leaf">◒</span><div><strong>AGRÁR MENTOR</strong><small>SZAKTANÁCSADÓI PORTÁL</small></div></div>
    <nav className="advisor-reference-nav">{items.map(([href,icon,label])=>{const active=href==="/admin"?pathname===href:pathname.startsWith(href);return <Link key={href} className={active?"active":""} href={href}><span>{icon}</span><b>{label}</b></Link>})}</nav>
    <div className="advisor-reference-help"><strong>Gyors szakmai munka</strong><small>Új feladat, szemle vagy ügyfél rögzítése néhány kattintással.</small><Link href="/admin/tasks">Teendő kiadása</Link></div>
    <div className="advisor-reference-user"><span>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div>
    <LogoutButton className="advisor-reference-logout"/>
  </aside>
}
