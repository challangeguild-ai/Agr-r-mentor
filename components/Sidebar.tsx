import Link from "next/link";

export function Sidebar({ active = "dashboard" }: { active?: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span>AM</span><strong>Agrár Mentor</strong></div>
      <nav>
        <Link className={active === "dashboard" ? "active" : ""} href="/dashboard">Áttekintés</Link>
        <a href="#gazdasag">Gazdaságom</a>
        <a href="#tablak">Táblák</a>
        <Link className={active === "tasks" ? "active" : ""} href="/tasks">Teendők</Link>
        <a href="#idovonal">Idővonal</a>
        <a href="#dokumentumok">Dokumentumok</a>
      </nav>
      <div className="sidebar-footer">MVP 0.1</div>
    </aside>
  );
}
