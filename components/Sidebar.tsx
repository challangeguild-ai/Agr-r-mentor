import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span>AM</span><strong>Agrár Mentor</strong></div>
      <nav>
        <Link className="active" href="/dashboard">Áttekintés</Link>
        <a href="#gazdasag">Gazdaságom</a>
        <a href="#tablak">Táblák</a>
        <a href="#teendok">Teendők</a>
        <a href="#idovonal">Idővonal</a>
        <a href="#dokumentumok">Dokumentumok</a>
      </nav>
      <div className="sidebar-footer">MVP 0.1</div>
    </aside>
  );
}
