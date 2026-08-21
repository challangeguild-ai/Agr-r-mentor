"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {LogoutButton} from "@/components/LogoutButton";

const items=[
  ["/admin","▦","Áttekintés"],
  ["/admin/clients","♙","Ügyfelek"],
  ["/admin/reports","!","Bejelentések"],
  ["/admin/inspections","⌖","Szemlék"],
  ["/admin/tasks","☑","Teendők"],
  ["/admin/timeline","◷","Idővonal"],
  ["/admin/documents","□","Dokumentumok"],
] as const;

export function AdvisorSidebar(){const pathname=usePathname();return <aside className="advisor-sidebar">
  <div className="portal-brand advisor-brand"><span className="portal-mark advisor-mark">AM</span><div><strong>AGRÁR MENTOR</strong><small>Szaktanácsadói felület</small></div></div>
  <nav className="portal-nav advisor-nav">{items.map(([href,icon,label])=>{const active=href==="/admin"?pathname===href:pathname.startsWith(href);return <Link key={href} className={active?"active":""} href={href}><span className="portal-nav-icon">{icon}</span><span>{label}</span></Link>})}</nav>
  <div className="portal-sidebar-bottom advisor-sidebar-bottom"><div className="portal-user advisor-user"><span>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div><LogoutButton className="portal-logout advisor-logout"/><small className="advisor-exclusive">Ez a felület kizárólag szaktanácsadók számára érhető el.</small></div>
</aside>}
