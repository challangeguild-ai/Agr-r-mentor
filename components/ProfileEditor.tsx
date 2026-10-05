"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import styles from "@/app/profile/profile.module.css";

type License={authorization_level:string;permit_number:string;valid_until:string;active:boolean}|null;

export function ProfileEditor({userId,email,fullName,phone,city,jobTitle,avatarUrl,license}:{userId:string;email:string;fullName:string;phone:string;city:string;jobTitle:string;avatarUrl:string|null;license:License}){
 const supabase=useMemo(()=>createClient(),[]);
 const[name,setName]=useState(fullName),[tel,setTel]=useState(phone),[town,setTown]=useState(city),[job,setJob]=useState(jobTitle),[avatar,setAvatar]=useState(avatarUrl);
 const[level,setLevel]=useState(license?.active?license.authorization_level:""),[permit,setPermit]=useState(license?.active?license.permit_number:""),[validUntil,setValidUntil]=useState(license?.active?license.valid_until:"");
 const[busy,setBusy]=useState(false),[message,setMessage]=useState("");

 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const fd=new FormData(e.currentTarget),file=fd.get("avatar");let nextAvatar=avatar;
   if(file instanceof File&&file.size){
    if(file.size>5*1024*1024)throw new Error("A profilkép legfeljebb 5 MB lehet.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("JPG, PNG vagy WebP profilkép tölthető fel.");
    const ext=file.name.split(".").pop()?.toLowerCase()||"jpg",path=`${userId}/avatar-${Date.now()}.${ext}`;
    const{error:up}=await supabase.storage.from("profile-avatars").upload(path,file,{contentType:file.type,upsert:true});if(up)throw up;
    nextAvatar=supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
   }
   const clean=name.trim();if(!clean)throw new Error("A név nem lehet üres.");
   const{error}=await supabase.from("profiles").update({full_name:clean,phone:tel.trim()||null,city:town.trim()||null,job_title:job.trim()||null,avatar_url:nextAvatar,updated_at:new Date().toISOString()}).eq("id",userId);if(error)throw error;
   const wants=!!(level||permit.trim()||validUntil);
   if(wants){
    if(!level||!permit.trim()||!validUntil)throw new Error("A növényvédelmi jogosultságnál minden adat kötelező.");
    if(validUntil<new Date().toISOString().slice(0,10))throw new Error("Lejárt növényvédelmi jogosultság nem állítható aktívra.");
    const{error:le}=await supabase.from("profile_plant_protection_licenses").upsert({user_id:userId,authorization_level:level,permit_number:permit.trim(),valid_until:validUntil,active:true,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(le)throw le;
   }else if(license){
    const{error:le}=await supabase.from("profile_plant_protection_licenses").update({active:false,updated_at:new Date().toISOString()}).eq("user_id",userId);if(le)throw le;
   }
   setAvatar(nextAvatar);setMessage("A profil frissítve.");setTimeout(()=>window.location.reload(),450);
  }catch(err){setMessage(err instanceof Error?err.message:"A mentés sikertelen.");setBusy(false)}
 }
 const initial=(name.trim()[0]||"G").toUpperCase();
 return <form className={styles.form} onSubmit={save}>
  <div className={styles.avatarRow}>{avatar?<img src={avatar} alt="Profilkép" className={styles.preview}/>:<div className={styles.fallback}>{initial}</div>}<div><strong>Profilkép</strong><p>JPG, PNG vagy WebP · legfeljebb 5 MB.</p><label className={styles.fileButton}>Új kép kiválasztása<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"/></label></div></div>
  <section className={styles.section}><div><span>SZEMÉLYES ADATOK</span><h2>Kapcsolattartás és megjelenés</h2></div><div className={styles.grid}><label>Teljes név<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} required/></label><label>E-mail cím<input value={email} readOnly disabled/></label><label>Telefonszám<input value={tel} onChange={e=>setTel(e.target.value)} maxLength={40} placeholder="+36…"/></label><label>Település<input value={town} onChange={e=>setTown(e.target.value)} maxLength={120} placeholder="pl. Nagykáta"/></label><label className={styles.wide}>Munkakör / megnevezés<input value={job} onChange={e=>setJob(e.target.value)} maxLength={120} placeholder="pl. gazdaságvezető"/></label></div></section>
  <section className={styles.section}><div><span>NÖVÉNYVÉDELMI JOGOSULTSÁG</span><h2>Saját szakmai jogosultság</h2><p>A jogosultság a személyhez tartozik; a gazdaság csak ezután jelölhet ki jóváhagyóként.</p></div><div className={styles.grid}><label>Kategória<select value={level} onChange={e=>setLevel(e.target.value)}><option value="">Nincs megadva</option><option value="I">I. kategória</option><option value="II">II. kategória</option><option value="III">III. kategória</option></select></label><label>Engedély / igazolvány száma<input value={permit} onChange={e=>setPermit(e.target.value)} maxLength={120}/></label><label>Érvényes eddig<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label></div></section>
  {message&&<div className={message.includes("frissítve")?styles.success:styles.error}>{message}</div>}
  <button className="btn btn-primary" disabled={busy}>{busy?"Mentés…":"Profil mentése"}</button>
 </form>;
}
