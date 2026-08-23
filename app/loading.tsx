export default function Loading(){
  return <main style={{minHeight:"55vh",display:"grid",placeItems:"center",padding:24}}><div style={{display:"grid",gap:10,justifyItems:"center",color:"#39752f"}}><span style={{width:34,height:34,borderRadius:"50%",border:"4px solid #dfe8db",borderTopColor:"#39752f",animation:"spin .8s linear infinite"}}/><strong>Adatok betöltése…</strong><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></main>;
}
