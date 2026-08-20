import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <strong>Agrár Mentor</strong>
        <Link className="btn btn-secondary" href="/login">Ügyfélkapu</Link>
      </nav>
      <section className="hero">
        <span className="eyebrow">SZEMÉLYES AGRÁR-SZAKTANÁCSADÁS</span>
        <h1>Átláthatóbb gazdálkodás.<br />Személyes szakmai támogatással.</h1>
        <p>Agrár-szaktanácsadás, helyszíni szemlék, feladatok és határidők egy közös digitális felületen.</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="mailto:kapcsolat@example.hu">Kapcsolatfelvétel</a>
          <Link className="btn btn-secondary" href="/login">Belépés az ügyfélkapuba</Link>
        </div>
      </section>
    </main>
  );
}
