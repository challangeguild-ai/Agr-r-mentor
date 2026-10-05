"use client";
import {FormEvent,useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import styles from "./LandingLoginModal.module.css";

type Stage="credentials"|"loading"|"setup"|"challenge";
type PendingEnrollment={userId:string;factorId:string;qr:string};
const pendingKey="agrar-mentor-mfa-pending:v2";
function safeNext(v:string|null|undefined){return v&&v.startsWith("/")&&!v.startsWith("//")?v:null}

export function LandingLoginModal({triggerLabel,triggerClassName,initialOpen=false,next=null}:{triggerLabel:string;triggerClassName?:string;initialOpen?:boolean;next?:string|null}){
 const supabase=useMemo(()=>createClient(),[]);
 const[open,setOpen]=useState(initialOpen),[stage,setStage]=useState<Stage>("credentials"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState(""),[factorId,setFactorId]=useState(""),[qr,setQr]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const resumed=useRef(false);

 useEffect(()=>{if(!open)return;const prev=document.body.style.overflow;document.body.style.overflow="hidden";const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("keydown",esc);return()=>{document.body.style.overflow=prev;document.removeEventListener("keydown",esc)}},[open]);

 async function routeAfterMfa(){
  const requested=safeNext(next);if(requested){window.location.assign(requested);return}
  const{data:{user}}=await supabase.auth.getUser();
  const{data:profile}=user?await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle():{data:null};
  window.location.assign(profile?.system_role==="admin"&&profile?.role==="advisor"?"/system-admin":profile?.role==="advisor"?"/admin":"/dashboard");
 }

 async function beginMfa(){
  setStage("loading");setBusy(true);setError("");setMessage("");
  const{data:{user}}=await supabase.auth.getUser();
  if(!user){setStage("credentials");setBusy(false);return}
  const{data,error}=await supabase.auth.mfa.listFactors();
  if(error){setError("A kétfaktoros hitelesítés állapota nem ellenőrizhető.");setStage("credentials");setBusy(false);return}
  const verified=data.totp?.find(f=>f.status==="verified");
  if(verified){setFactorId(verified.id);setStage("challenge");setBusy(false);return}
  try{
   const raw=sessionStorage.getItem(pendingKey);
   if(raw){const p=JSON.parse(raw) as PendingEnrollment;if(p.userId===user.id&&p.factorId&&p.qr){setFactorId(p.factorId);setQr(p.qr);setStage("setup");setBusy(false);return}sessionStorage.removeItem(pendingKey)}
  }catch{}
  const{data:enrolled,error:enrollError}=await supabase.auth.mfa.enroll({factorType:"totp"});
  if(enrollError||!enrolled){setError("A kétfaktoros hitelesítés beállítása sikertelen.");setStage("credentials");setBusy(false);return}
  const pending:PendingEnrollment={userId:user.id,factorId:enrolled.id,qr:enrolled.totp.qr_code};
  try{sessionStorage.setItem(pendingKey,JSON.stringify(pending))}catch{}
  setFactorId(pending.factorId);setQr(pending.qr);setStage("setup");setBusy(false);
 }

 useEffect(()=>{if(!open||!initialOpen||resumed.current)return;resumed.current=true;(async()=>{const{data:{user}}=await supabase.auth.getUser();if(user)void beginMfa()})()},[open,initialOpen,supabase]);

 async function submitCredentials(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");const{error}=await supabase.auth.signInWithPassword({email,password});if(error){setBusy(false);setError("Sikertelen belépés. Ellenőrizd az e-mail címet és a jelszót.");return}await beginMfa()}
 async function verify(e:FormEvent){e.preventDefault();setBusy(true);setError("");const clean=code.replace(/\D/g,"");if(!/^\d{6}$/.test(clean)){setError("Adj meg egy 6 jegyű hitelesítő kódot.");setBusy(false);return}const{error}=await supabase.auth.mfa.challengeAndVerify({factorId,code:clean});if(error){if(error.code==="mfa_factor_not_found"){try{sessionStorage.removeItem(pendingKey)}catch{}setCode("");await beginMfa();return}setError("A kód hibás vagy lejárt. Várd meg az új kódot, majd próbáld újra.");setBusy(false);return}try{sessionStorage.removeItem(pendingKey)}catch{}await routeAfterMfa()}
 async function recover(){setError("");setMessage("");if(!email){setError("Add meg előbb az e-mail címedet.");return}setBusy(true);const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});setBusy(false);if(error){setError("A jelszó-visszaállító e-mail küldése sikertelen.");return}setMessage("Elküldtük a jelszó-visszaállító e-mailt.")}

 return <><button type="button" className={triggerClassName} onClick={()=>{setOpen(true);setStage("credentials");setError("");setMessage("")}}>{triggerLabel}</button>{open&&<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="agrar-login-title"><button className={styles.close} type="button" aria-label="Bejelentkezés bezárása" onClick={()=>setOpen(false)}>×</button>
  <div className={styles.brand}><span><svg viewBox="0 0 42 54" aria-hidden="true"><path d="M21 51V8"/><path d="M21 17C14 14 10 10 9 5c7 1 11 5 12 12Z"/><path d="M21 25c7-3 11-7 12-12-7 1-11 5-12 12Z"/><path d="M21 32c-7-3-11-7-12-12 7 1 11 5 12 12Z"/><path d="M21 40c7-3 11-7 12-12-7 1-11 5-12 12Z"/><path d="M21 47c-7-3-11-7-12-12 7 1 11 5 12 12Z"/></svg></span><div><strong>AGRÁR MENTOR</strong><small>TUDÁS. TERV. EREDMÉNY.</small></div></div>
  {stage==="credentials"?<><h2 id="agrar-login-title">Belépés az ügyfélfelületre</h2><p>Lépj be az Agrár Mentor digitális ügyfélfelületére.</p><form onSubmit={submitCredentials}><label>E-mail cím<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required autoFocus/></label><label>Jelszó<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>{error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}<button className={styles.primary} disabled={busy}>{busy?"Belépés…":"Belépés"}</button><button type="button" className={styles.secondary} onClick={recover} disabled={busy}>Elfelejtett jelszó</button></form></>:
   stage==="loading"?<><h2 id="agrar-login-title">Biztonsági ellenőrzés</h2><p>A kétfaktoros hitelesítés előkészítése folyamatban…</p><div className={styles.loading}>Ellenőrzés…</div></>:
   <><h2 id="agrar-login-title">{stage==="setup"?"Kétfaktoros hitelesítés beállítása":"Kétfaktoros hitelesítés"}</h2><p>{stage==="setup"?"Olvasd be a QR-kódot a hitelesítő alkalmazásoddal, majd add meg a 6 jegyű kódot.":"Nyisd meg a hitelesítő alkalmazásodat, és add meg a 6 jegyű kódot."}</p>{stage==="setup"&&qr&&<img className={styles.qr} src={qr} alt="Authenticator QR-kód"/>}<form onSubmit={verify}><label>6 jegyű hitelesítő kód<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} required autoFocus/></label>{error&&<div className={styles.error}>{error}</div>}<button className={styles.primary} disabled={busy||!factorId}>{busy?"Ellenőrzés…":stage==="setup"?"Beállítás megerősítése":"Belépés megerősítése"}</button></form></>}
  <small className={styles.security}>Biztonságos belépés · a hitelesítő kód rövid időnként változik.</small>
 </section></div>}</>
}
