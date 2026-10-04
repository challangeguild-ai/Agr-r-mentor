"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import styles from "@/app/profile/profile.module.css";

export function ProfileEditor({userId,fullName,phone,avatarUrl}:{userId:string;fullName:string;phone:string;avatarUrl:string|null}){
 const supabase=useMemo(()=>createClient(),[]);
 const[name,setName]=useState(fullName),[tel,setTel]=useState(phone),[avatar,setAvatar]=useState(avatarUrl);
 const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");
  try{
   const fd=new FormData(e.currentTarget);const file=fd.get("avatar");
   let nextAvatar=avatar;
   if(file instanceof File&&file.size){
    if(file.size>5*1024*1024)throw new Error("A profilkép legfeljebb 5 MB lehet.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("JPG, PNG vagy WebP profilkép tölthető fel.");
    const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
    const path=`${userId}/avatar-${Date.now()}.${ext}`;
    const{error:uploadError}=await supabase.storage.from("profile-avatars").upload(path,file,{contentType:file.type,upsert:true});
    if(uploadError)throw uploadError;
    const{data}=supabase.storage.from("profile-avatars").getPublicUrl(path);nextAvatar=data.publicUrl;
   }
   const cleanName=name.trim();if(!cleanName)throw new Error("A név nem lehet üres.");
   const{error}=await supabase.from("profiles").update({full_name:cleanName,phone:tel.trim()||null,avatar_url:nextAvatar,updated_at:new Date().toISOString()}).eq("id",userId);
   if(error)throw error;
   setAvatar(nextAvatar);setMessage("A profil frissítve.");setTimeout(()=>window.location.reload(),450);
  }catch(err){setMessage(err instanceof Error?err.message:"A mentés sikertelen.");setBusy(false)}
 }
 const initial=(name.trim()[0]||"G").toUpperCase();
 return <form className={styles.form} onSubmit={save} data-help-block="profile-editor">
  <div className={styles.avatarRow}>
   {avatar?<img src={avatar} alt="Profilkép" className={styles.preview}/>:<div className={styles.fallback}>{initial}</div>}
   <div><strong>Profilkép</strong><p>JPG, PNG vagy WebP · legfeljebb 5 MB.</p><label className={styles.fileButton}>Új kép kiválasztása<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"/></label></div>
  </div>
  <div className={styles.grid}>
   <label>Teljes név<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} required/></label>
   <label>Telefonszám<input value={tel} onChange={e=>setTel(e.target.value)} maxLength={40} placeholder="+36…"/></label>
  </div>
  {message&&<div className={message.includes("frissítve")?styles.success:styles.error}>{message}</div>}
  <button className="btn btn-primary" disabled={busy}>{busy?"Mentés…":"Profil mentése"}</button>
 </form>;
}
