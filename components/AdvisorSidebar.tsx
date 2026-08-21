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
  ["/admin/timeline","☼","Idővonal"],
  ["/admin/documents","□","Dokumentumok"],
] as const;

export function AdvisorSidebar(){const pathname=usePathname();return <aside className="advisor-sidebar">
  <div className="portal-brand advisor-brand"><span className="portal-mark advisor-mark">AM</span><div><strong>AGRÁR MENTOR</strong><small>SZAKTANÁCSADÓI PORTÁL</small></div></div>
  <nav className="portal-nav advisor-nav">{items.map(([href,icon,label])=>{const active=href==="/admin"?pathname===href:pathname.startsWith(href);return <Link key={href} className={active?"active":""} href={href}><span className="portal-nav-icon">{icon}</span><span>{label}</span></Link>})}</nav>
  <div className="advisor-help"><strong>Gyors művelet</strong><small>Új szakmai feladat vagy szemle indítása.</small><Link href="/admin/tasks">Teendő kiadása</Link></div>
  <div className="portal-sidebar-bottom advisor-sidebar-bottom"><div className="portal-user advisor-user"><span>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div><LogoutButton className="portal-logout advisor-logout"/><small className="advisor-exclusive">Agrár Mentor · Szaktanácsadói rendszer</small></div>
</aside>}
