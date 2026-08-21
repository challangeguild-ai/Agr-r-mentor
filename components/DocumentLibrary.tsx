"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import styles from "./DocumentLibrary.module.css";

const labels:Record<string,string>={talajvizsgalat:"Talajvizsgálat",permetezes:"Permetezés",szerzodes:"Szerződés",szamla:"Számla",foto:"Fotó",egyeb:"Egyéb"};

export function DocumentLibrary({items}:{items:any[]}){
  const router=useRouter();
  const[query,setQuery]=useState("");
  const[category,setCategory]=useState("all");
  const[busy,setBusy]=useState<string|null>(null);
  const visible=useMemo(()=>items.filter(d=>{
    const q=query.trim().toLocaleLowerCase("hu-HU");
    const hay=[d.title,d.notes,d.file_name,d.fields?.name,d.farms?.name,labels[d.category]].filter(Boolean).join(" ").toLocaleLowerCase("hu-HU");
    return(category==="all"||d.category===category)&&(!q||hay.includes(q));
  }),[items,query,category]);

  async function openDoc(d:any){setBusy(`open-${d.id}`);const supabase=createClient();const{data,error}=await supabase.storage.from("documents").createSignedUrl(d.storage_path,60);setBusy(null);if(error||!data?.signedUrl){alert("A dokumentum megnyitása sikertelen.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")}
  async function deleteDoc(d:any){if(!confirm(`Biztosan törlöd ezt a dokumentumot?\n\n${d.title}`))return;setBusy(`delete-${d.id}`);const supabase=createClient();const storage=await supabase.storage.from("documents").remove([d.storage_path]);if(storage.error){alert(`A fájl törlése sikertelen: ${storage.error.message}`);setBusy(null);return}const row=await supabase.from("documents").delete().eq("id",d.id);if(row.error){alert(`Az adatbázis-bejegyzés törlése sikertelen: ${row.error.message}`);setBusy(null);return}setBusy(null);router.refresh()}

  return <>
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}><span>⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Keresés név, megjegyzés, gazdaság vagy tábla alapján..."/></div>
      <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Minden kategória</option><option value="talajvizsgalat">Talajvizsgálat</option><option value="permetezes">Permetezés</option><option value="szerzodes">Szerződés</option><option value="szamla">Számla</option><option value="foto">Fotó</option><option value="egyeb">Egyéb</option></select>
    </div>
    <div className={styles.resultLine}><span>{visible.length} találat</span>{(query||category!=="all")&&<button type="button" onClick={()=>{setQuery("");setCategory("all")}}>Szűrők törlése</button>}</div>
    {!visible.length?<div className={styles.empty}><div><div className={styles.emptyIcon}>▱</div><strong>{items.length?"Nincs a szűrésnek megfelelő dokumentum.":"Még nincs feltöltött dokumentum."}</strong><p>{items.length?"Módosítsd a keresést vagy a kategóriát.":"Tölts fel egy dokumentumot a fenti űrlap segítségével."}</p></div></div>:<div className={styles.list}>{visible.map(d=><article className={styles.card} key={d.id}><div className={styles.cardTop}><div className={styles.fileIcon}>▤</div><div className={styles.title}><strong>{d.title}</strong><small>{new Date(d.created_at).toLocaleDateString("hu-HU")} · {d.file_name}</small></div><span className={styles.badge}>{labels[d.category]||"Dokumentum"}</span></div><div className={styles.meta}>{d.fields?.name?<span>Földtábla: <b>{d.fields.name}</b></span>:d.farms?.name?<span>Gazdaság: <b>{d.farms.name}</b></span>:null}{d.notes&&<p>{d.notes}</p>}</div><div className={styles.actions}><button type="button" className="btn btn-secondary" onClick={()=>openDoc(d)} disabled={busy===`open-${d.id}`}>{busy===`open-${d.id}`?"Megnyitás…":"Megnyitás"}</button><button type="button" className={styles.deleteButton} onClick={()=>deleteDoc(d)} disabled={busy===`delete-${d.id}`}>{busy===`delete-${d.id}`?"Törlés…":"Törlés"}</button></div></article>)}</div>}
  </>;
}