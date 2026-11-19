import type {FieldBoundaryQuality} from "@/lib/fieldBoundaryQuality";

export function FieldBoundaryQualityPanel({quality,compact=false}:{quality:FieldBoundaryQuality;compact?:boolean}){
  const warnings=quality.issues.filter(issue=>issue.severity==="warning").length;
  return <section aria-label="Automatikus táblahatár-ellenőrzés" style={{padding:compact?10:15,background:warnings?"#fff8ed":"#f4f9f4",border:`1px solid ${warnings?"#efd0a5":"#d1dfd0"}`,borderRadius:12,display:"grid",gap:8}}>
    <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center"}}><strong>Táblahatár gyors ellenőrzése</strong><span className="user-pill">{warnings?`${warnings} ellenőrizendő eltérés`:quality.estimatedHa===null?"Csak helypont":quality.issues.length?"Részleges ellenőrzés":"Nincs észlelt eltérés"}</span></div>
    <small style={{color:"#526253"}}>{quality.estimatedHa===null?"Csak helypont – terület nem számolható.":`Becsült terület: ${quality.estimatedHa.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha · ${quality.vertices} töréspont · ${quality.polygonCount} poligon`}{quality.overlapChecked>0?` · ${quality.overlapChecked} szomszédos poligon megvizsgálva`:""}</small>
    {quality.issues.length>0?<ul style={{display:"grid",gap:7,margin:"4px 0 0",paddingLeft:19}}>{quality.issues.map((issue,index)=><li key={`${issue.code}-${index}`} style={{fontSize:13,color:issue.severity==="warning"?"#8a4d16":"#526253"}}><strong>{issue.title}.</strong> {issue.detail}</li>)}</ul>:<p style={{margin:0,fontSize:13,color:"#526253"}}>{quality.estimatedHa===null?"A helypont beküldhető poligon nélkül is. Ez nem jelenti a határ pontosságának ellenőrzését.":"Az ellenőrzött adatok között nem találtunk kirívó eltérést. Ettől még a poligon nem válik hiteles földhivatali adattá."}</p>}
    <small style={{color:"#6f7c74"}}>Tájékoztató jelzések, nem jogi területkimérés. Az OSM, saját mérés és dokumentumillesztés pontosságát a felhasználónak kell ellenőriznie. A figyelmeztetések nem akadályozzák a javaslat beküldését.</small>
  </section>;
}
