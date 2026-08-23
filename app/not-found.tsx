import Link from "next/link";

export default function NotFound(){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f5f4ef"}}>
    <section style={{width:"min(560px,100%)",background:"#fff",border:"1px solid #dfe5df",borderRadius:18,padding:28,boxShadow:"0 10px 30px rgba(20,45,30,.07)"}}>
      <span className="eyebrow">AGRÁR MENTOR</span>
      <h1 style={{margin:"8px 0",fontSize:28,color:"#172019"}}>Ez az oldal nem található.</h1>
      <p style={{margin:"0 0 20px",lineHeight:1.6,color:"#677169"}}>A hivatkozás elavult lehet, vagy az adott adat már nem érhető el. A rögzített gazdasági adatok ettől nem vesztek el.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="btn btn-primary" href="/dashboard">Vissza a főoldalra</Link><Link className="btn btn-secondary" href="/login">Belépés</Link></div>
    </section>
  </main>;
}
