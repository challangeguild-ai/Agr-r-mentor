"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Agrár Mentor alkalmazáshiba", error);
  }, [error]);

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f6f5f0"}}>
      <section style={{width:"min(560px,100%)",background:"#fff",border:"1px solid #e0e5df",borderRadius:16,padding:28,boxShadow:"0 8px 30px rgba(20,45,30,.08)"}}>
        <span style={{display:"inline-grid",placeItems:"center",width:44,height:44,borderRadius:12,background:"#fff0d8",color:"#b96b00",fontSize:24,fontWeight:900,marginBottom:14}}>!</span>
        <h1 style={{margin:"0 0 8px",fontSize:24,color:"#172019"}}>Valami nem sikerült.</h1>
        <p style={{margin:"0 0 18px",lineHeight:1.6,color:"#677169"}}>Az Agrár Mentor egy váratlan hibába ütközött. Próbáld meg újratölteni ezt a részt. Ha a hiba ismét jelentkezik, a rendszer naplózza a technikai részleteket.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={reset} style={{border:0,borderRadius:9,padding:"11px 16px",background:"#2f7d31",color:"#fff",fontWeight:800,cursor:"pointer"}}>Újrapróbálás</button>
          <button onClick={()=>window.location.href="/dashboard"} style={{border:"1px solid #d8dfd8",borderRadius:9,padding:"11px 16px",background:"#fff",color:"#27352c",fontWeight:700,cursor:"pointer"}}>Vissza a főoldalra</button>
        </div>
        {error.digest && <small style={{display:"block",marginTop:18,color:"#8a928c"}}>Hibakód: {error.digest}</small>}
      </section>
    </main>
  );
}
