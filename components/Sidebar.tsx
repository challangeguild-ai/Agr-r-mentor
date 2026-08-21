import Link from "next/link";
import {LogoutButton} from "@/components/LogoutButton";

const items=[
  ["/dashboard","dashboard","⌂","Áttekintés"],
  ["/farms","farms","▥","Gazdaságom"],
  ["/fields","fields","◩","Táblák"],
  ["/tasks","tasks","☑","Teendők"],
  ["/timeline","timeline","☼","Idővonal"],
  ["/documents","documents","□","Dokumentumok"],
  ["/invoices","invoices","▤","Számlák"],
  ["/messages","messages","✉","Üzenetek"],
] as const;

export function Sidebar({active="dashboard",userName="Gazdálkodó"}:{active?:string;userName?:string}){
  const initials=userName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"G";
  return <aside className="farmer-sidebar farmer-sidebar-template">
    <div className="farmer-template-brand"><span className="farmer-template-leaf">◒</span><div><strong>AGRÁR MENTOR</strong><small>GAZDÁLKODÓI PORTÁL</small></div></div>
    <nav className="portal-nav farmer-template-nav">{items.map(([href,key,icon,label])=><Link key={key} className={active===key?"active":""} href={href}><span className="portal-nav-icon">{icon}</span><span>{label}</span>{key==="invoices"&&<em>Új</em>}</Link>)}</nav>
    <div className="farmer-help"><strong>Kérdése van?</strong><small>Írjon a szaktanácsadójának.</small><Link href="/messages">Kapcsolatfelvétel</Link></div>
    <div className="portal-sidebar-bottom farmer-template-bottom"><div className="portal-user"><span>{initials}</span><div><strong>{userName}</strong><small>Gazdálkodó</small></div></div><LogoutButton/><small className="portal-version">Agrár Mentor</small></div>
  </aside>
}
