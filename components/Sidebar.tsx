import Link from "next/link";
import {LogoutButton} from "@/components/LogoutButton";

const items=[
  ["/dashboard","dashboard","⌂","Kezdőlap"],
  ["/timeline","timeline","◷","Idővonal"],
  ["/farms","farms","⌂","Gazdaságom"],
  ["/fields","fields","▱","Táblák"],
  ["/documents","documents","□","Dokumentumok"],
  ["/tasks","tasks","✓","Teendők"],
] as const;

export function Sidebar({active="dashboard"}:{active?:string}){
  return <aside className="farmer-sidebar">
    <div className="portal-brand farmer-brand"><span className="portal-mark">AM</span><div><strong>AGRÁR MENTOR</strong><small>Gazdálkodói felület</small></div></div>
    <nav className="portal-nav">{items.map(([href,key,icon,label])=><Link key={key} className={active===key?"active":""} href={href}><span className="portal-nav-icon">{icon}</span><span>{label}</span></Link>)}</nav>
    <div className="portal-sidebar-bottom"><div className="portal-user"><span>TG</span><div><strong>Gazdálkodó</strong><small>Saját fiók</small></div></div><LogoutButton/><small className="portal-version">v1.0.0</small></div>
  </aside>
}
