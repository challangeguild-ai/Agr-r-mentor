"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {NotificationBell} from "@/components/NotificationBell";
import {LogoutButton} from "@/components/LogoutButton";
import {createClient} from "@/lib/supabase/client";
import styles from "./FarmerTopbar.module.css";

type ProfileState={full_name:string|null;avatar_url:string|null};

export function FarmerTopbar({
 userName="Gazdálkodó",
 placeholder="Keresés táblák, feladatok és események között…",
 defaultQuery=""
}:{userName?:string;placeholder?:string;defaultQuery?:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const[profile,setProfile]=useState<ProfileState>({full_name:userName,avatar_url:null});
 const[open,setOpen]=useState(false);
 const wrap=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{let alive=true;(async()=>{
  const{data:{user}}=await supabase.auth.getUser();if(!user)return;
  const{data}=await supabase.from("profiles").select("full_name,avatar_url").eq("id",user.id).maybeSingle();
  if(alive&&data)setProfile(data as ProfileState);
 })();return()=>{alive=false}},[supabase]);

 useEffect(()=>{function outside(e:MouseEvent){if(open&&wrap.current&&!wrap.current.contains(e.target as Node))setOpen(false)}
  function esc(e:KeyboardEvent){if(e.key==="Escape")setOpen(false)}
  document.addEventListener("mousedown",outside);document.addEventListener("keydown",esc);
  return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",esc)}
 },[open]);

 const name=profile.full_name?.trim()||userName||"Gazdálkodó";
 const initial=name.slice(0,1).toUpperCase()||"G";
 return <header className={styles.bar} data-tour="farmer-topbar">
  <form className={styles.search} action="/dashboard" method="get" data-tour="farmer-global-search">
   <span aria-hidden="true">⌕</span>
   <input name="q" defaultValue={defaultQuery} placeholder="Keresés…" aria-label={placeholder} title={placeholder}/>
   <button type="submit">Keresés</button>
  </form>
  <div className={styles.actions}>
   <div data-tour="farmer-notification-bell"><NotificationBell/></div>
   <div className={styles.profileWrap} ref={wrap}>
    <button className={styles.profile} type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu" data-tour="farmer-profile-menu">
     {profile.avatar_url?<img className={styles.avatarImage} src={profile.avatar_url} alt="Profilkép"/>:<span className={styles.avatar}>{initial}</span>}
     <span className={styles.profileText}><strong>{name}</strong><small>Gazdálkodó</small></span>
     <span className={styles.chevron} aria-hidden="true">⌄</span>
    </button>
    {open&&<div className={styles.menu} role="menu">
      <div className={styles.menuHead}>
       {profile.avatar_url?<img className={styles.menuAvatar} src={profile.avatar_url} alt="Profilkép"/>:<span className={styles.menuFallback}>{initial}</span>}
       <div><strong>{name}</strong><small>Gazdálkodói profil</small></div>
      </div>
      <Link href="/profile" role="menuitem" onClick={()=>setOpen(false)}>Profil és profilkép <span>→</span></Link>
      <Link href="/notifications" role="menuitem" onClick={()=>setOpen(false)}>Értesítési központ <span>→</span></Link>
      <Link href="/team" role="menuitem" onClick={()=>setOpen(false)}>Munkatársak <span>→</span></Link>
      <div className={styles.logoutRow}><LogoutButton className={styles.logout}/></div>
    </div>}
   </div>
  </div>
 </header>;
}
