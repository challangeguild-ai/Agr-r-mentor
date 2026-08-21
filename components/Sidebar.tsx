import Link from "next/link";

export function Sidebar({ active = "dashboard" }: { active?: string }) {
  return (
    <aside className="sidebar farmer-sidebar">
      <div className="sidebar-brand"><span>AM</span><div><strong>AGRÁR MENTOR</strong><small>Gazdálkodói felület</small></div></div>
      <nav>
        <Link className={active === "dashboard" ? "active" : ""} href="/dashboard">Kezdőlap</Link>
        <Link className={active === "timeline" ? "active" : ""} href="/timeline">Idővonal</Link>
        <Link className={active === "farms" ? "active" : ""} href="/farms">Gazdaságom</Link>
        <Link className={active === "fields" ? "active" : ""} href="/fields">Táblák</Link>
        <Link className={active === "tasks" ? "active" : ""} href="/tasks">Teendők</Link>
        <Link className={active === "documents" ? "active" : ""} href="/documents">Dokumentumok</Link>
      </nav>
      <div className="sidebar-footer">Agrár Mentor · Gazdálkodói portál</div>
    </aside>
  );
}
