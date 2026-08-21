import Link from "next/link";

export function Sidebar({ active = "dashboard" }: { active?: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span>AM</span><strong>Agrár Mentor</strong></div>
      <nav>
        <Link className={active === "dashboard" ? "active" : ""} href="/dashboard">Áttekintés</Link>
        <Link className={active === "farms" ? "active" : ""} href="/farms">Gazdaságom</Link>
        <Link className={active === "fields" ? "active" : ""} href="/fields">Táblák</Link>
        <Link className={active === "tasks" ? "active" : ""} href="/tasks">Teendők</Link>
        <Link className={active === "timeline" ? "active" : ""} href="/timeline">Idővonal</Link>
        <a href="#dokumentumok">Dokumentumok</a>
      </nav>
      <div className="sidebar-footer">MVP 0.1</div>
    </aside>
  );
}
