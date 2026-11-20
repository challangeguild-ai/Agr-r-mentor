"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {inviteFarmMember} from "@/app/team/actions";

type Farm={id:string;name:string};
type Role=[string,string];

export function TeamInviteWizard({farms,roles}:{farms:Farm[];roles:Role[]}){
 const router=useRouter();
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false);
 const[step,setStep]=useState(0);const[farm,setFarm]=useState(""),[role,setRole]=useState("operator"),[name,setName]=useState(""),[email,setEmail]=useState("");
 const farmName=farms.find(f=>f.id===farm)?.name||"—";const roleName=roles.find(r=>r[0]===role)?.[1]||role;
 const canNext=step===0?!!farm&&roles.some(([id])=>id===role):step===1?!!name.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()):true;
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!farm||!roles.some(([id])=>id===role)||!name.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){
   setError("Ellenőrizd a gazdaságot, a szerepkört, a nevet és az e-mail címet.");return;
  }
  setBusy(true);setError("");
  try{await inviteFarmMember(new FormData(event.currentTarget));setSent(true);router.refresh()}
  catch(e){setError(e instanceof Error?e.message:"A meghívó elküldése sikertelen.")}
  finally{setBusy(false)}
 }
 if(sent)return <section className="am-wizard am-wizard-step" role="status">
  <h3>Meghívó elküldve</h3><p>A meghívást a <strong>{email}</strong> címre elküldtük.</p>
  <button type="button" className="btn btn-secondary" onClick={()=>{setSent(false);setStep(0);setName("");setEmail("");setError("")}}>Új munkatárs meghívása</button>
 </section>;
 return <form onSubmit={submit} aria-busy={busy} className="am-wizard" data-tour="farmer-team-wizard">
  <div className="am-wizard-progress am-wizard-progress-labeled"><span className={step>=0?"active":""}>Gazdaság és szerepkör</span><i/><span className={step>=1?"active":""}>Munkatárs adatai</span><i/><span className={step>=2?"active":""}>Ellenőrzés és meghívás</span></div>
  <input type="hidden" name="farm_id" value={farm}/><input type="hidden" name="member_role" value={role}/><input type="hidden" name="full_name" value={name}/><input type="hidden" name="email" value={email}/>
  {step===0&&<section className="am-wizard-step"><span className="eyebrow">MEGHÍVÁS</span><h3>Hova és milyen szerepkörbe?</h3><div className="am-wizard-grid"><label>Gazdaság<select value={farm} onChange={e=>setFarm(e.target.value)} required><option value="">Válassz gazdaságot</option>{farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Szerepkör<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div></section>}
  {step===1&&<section className="am-wizard-step"><span className="eyebrow">MEGHÍVÁS</span><h3>Kit hívsz meg?</h3><div className="am-wizard-grid"><label>Teljes név<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} required/></label><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label></div></section>}
  {step===2&&<section className="am-wizard-step"><span className="eyebrow">MEGHÍVÁS</span><h3>Ellenőrzés és meghívás</h3><div className="am-wizard-summary"><div><small>Gazdaság</small><strong>{farmName}</strong></div><div><small>Munkatárs</small><strong>{name||"—"}</strong></div><div><small>E-mail</small><strong>{email||"—"}</strong></div><div><small>Szerepkör</small><strong>{roleName}</strong></div></div><p>A munkatárs saját fiókot kap; csak a szerepköréhez szükséges gazdasági funkciókat fogja elérni.</p></section>}
  {error&&<div className="error-box" role="alert">{error}</div>}
  <div className="am-wizard-actions">{step>0&&<button type="button" className="ghost-btn" onClick={()=>setStep(s=>s-1)}>← Vissza</button>}<span/>{step<2?<button type="button" className="btn btn-primary" disabled={!canNext} onClick={()=>canNext&&setStep(s=>s+1)}>Tovább →</button>:<button className="btn btn-primary" type="submit" disabled={busy}>{busy?"Küldés…":"Meghívó küldése"}</button>}</div>
 </form>;
}
