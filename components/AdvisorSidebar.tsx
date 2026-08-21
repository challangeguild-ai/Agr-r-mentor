import Link from "next/link";

const items=[
  ["/admin","Áttekintés"],
  ["/admin/clients","Ügyfelek"],
  ["/admin/reports","Bejelentések"],
  ["/admin/inspections","Szemlék"],
  ["/admin/tasks","Teendők"],
] as const;

export function AdvisorSidebar(){return <aside className="advisor-sidebar"><div className="advisor-brand"><span className="advisor-logo">AM</span><div><strong>AGRÁR MENTOR</strong><small>Szaktanácsadói felület</small></div></div><nav>{items.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="advisor-sidebar-footer"><Link href="/logout">Kilépés</Link><small>Ez a felület kizárólag szaktanácsadók számára érhető el.</small></div></aside>}
