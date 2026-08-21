import Link from "next/link";

const items=[
  ["/admin","▦","Áttekintés"],
  ["/admin/clients","♙","Ügyfelek"],
  ["/admin/reports","!","Bejelentések"],
  ["/admin/inspections","⌖","Szemlék"],
  ["/admin/tasks","☑","Teendők"],
] as const;

export function AdvisorSidebar(){return <aside className="advisor-sidebar">
  <div className="portal-brand advisor-brand"><span className="portal-mark advisor-mark">AM</span><div><strong>AGRÁR MENTOR</strong><small>Szaktanácsadói felület</small></div></div>
  <nav className="portal-nav advisor-nav">{items.map(([href,icon,label])=><Link key={href} href={href}><span className="portal-nav-icon">{icon}</span><span>{label}</span></Link>)}</nav>
  <div className="portal-sidebar-bottom advisor-sidebar-bottom"><div className="portal-user advisor-user"><span>SA</span><div><strong>Szaktanácsadó</strong><small>Szakmai fiók</small></div></div><Link className="portal-logout advisor-logout" href="/logout"><span>↪</span>Kijelentkezés</Link><small className="advisor-exclusive">Ez a felület kizárólag szaktanácsadók számára érhető el.</small></div>
</aside>}
