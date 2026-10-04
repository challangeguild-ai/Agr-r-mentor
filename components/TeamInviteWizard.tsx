"use client";
import {useState} from "react";
import {inviteFarmMember} from "@/app/team/actions";

type Farm={id:string;name:string};
type Role=[string,string];

export function TeamInviteWizard({farms,roles}:{farms:Farm[];roles:Role[]}){
 const[step,setStep]=useState(0);const[farm,setFarm]=useState(""),[role,setRole]=useState("operator"),[name,setName]=useState(""),[email,setEmail]=useState("");
 const farmName=farms.find(f=>f.id===farm)?.name||"—";const roleName=roles.find(r=>r[0]===role)?.[1]||role;
 const canNext=step===0?!!farm:step===1?!!name.trim()&&email.includes("@"):true;
 return <form action={inviteFarmMember} className="am-wizard" data-tour="farmer-team-wizard">
  <div className="am-wizard-progress"><span className={step>=0?"active":""}>1</span><i/><span className={step>=1?"active":""}>2</span><i/><span className={step>=2?"active":""}>3</span></div>
  <input type="hidden" name="farm_id" value={farm}/><input type="hidden" name="member_role" value={role}/><input type="hidden" name="full_name" value={name}/><input type="hidden" name="email" value={email}/>
  {step===0&&<section className="am-wizard-step"><span className="eyebrow">1. LÉPÉS</span><h3>Hova és milyen szerepkörbe?</h3><div className="am-wizard-grid"><label>Gazdaság<select value={farm} onChange={e=>setFarm(e.target.value)} required><option value="">Válassz gazdaságot</option>{farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Szerepkör<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div></section>}
  {step===1&&<section className="am-wizard-step"><span className="eyebrow">2. LÉPÉS</span><h3>Kit hívsz meg?</h3><div className="am-wizard-grid"><label>Teljes név<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} required/></label><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label></div></section>}
  {step===2&&<section className="am-wizard-step"><span className="eyebrow">3. LÉPÉS</span><h3>Ellenőrzés és meghívás</h3><div className="am-wizard-summary"><div><small>Gazdaság</small><strong>{farmName}</strong></div><div><small>Munkatárs</small><strong>{name||"—"}</strong></div><div><small>E-mail</small><strong>{email||"—"}</strong></div><div><small>Szerepkör</small><strong>{roleName}</strong></div></div><p>A munkatárs saját fiókot kap; csak a szerepköréhez szükséges gazdasági funkciókat fogja elérni.</p></section>}
  <div className="am-wizard-actions">{step>0&&<button type="button" className="ghost-btn" onClick={()=>setStep(s=>s-1)}>← Vissza</button>}<span/>{step<2?<button type="button" className="btn btn-primary" disabled={!canNext} onClick={()=>canNext&&setStep(s=>s+1)}>Tovább →</button>:<button className="btn btn-primary" type="submit">Meghívó küldése</button>}</div>
 </form>;
}
