import Link from "next/link";
import type {DailyAlert} from "@/lib/dailyWorkAlerts";

export function DailyAlertStrip({alerts}:{alerts:DailyAlert[]}){
 if(!alerts.length)return null;
 return <section className="panel" data-help-block="daily-critical-alerts">
  <div className="panel-heading"><div><span className="eyebrow">AZONNALI FIGYELEM</span><h2>Kritikus és sürgős ügyek</h2></div><span className="user-pill">{alerts.length} tétel</span></div>
  <div style={{display:"grid",gap:8,padding:14}}>{alerts.map(alert=>{
   const tone=alert.level==="critical"?"#a72f27":alert.level==="warning"?"#b77700":"#39752f";
   return <Link key={alert.id} href={alert.href} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:12,border:"1px solid #e2e6e1",borderLeft:`4px solid ${tone}`,borderRadius:10,textDecoration:"none",color:"inherit",background:"#fff"}}><div><small style={{fontWeight:900,color:tone}}>{alert.title}</small><strong style={{display:"block",marginTop:3}}>{alert.body}</strong></div><span className="ghost-btn">Részletek</span></Link>})}</div>
 </section>;
}
