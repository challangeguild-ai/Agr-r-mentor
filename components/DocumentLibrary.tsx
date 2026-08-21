"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import styles from "./DocumentLibrary.module.css";

const labels:Record<string,string>={talajvizsgalat:"Talajvizsgálat",permetezes:"Permetezés",szerzodes:"Szerződés",szamla:"Számla",foto:"Fotó",egyeb:"Egyéb"};
function fileSize(v:number|null|undefined){if(!v)return"";if(v<1024)return`${v} B`;if(v<1024*1024)return`${(v/1024).toFixed(1)} KB`;return`${(v/1024/1024).toFixed(1)} MB`}

export function DocumentLibrary({items}:{items:any[]}){
  const router=useRouter();
  const[query,setQuery]=useState("");
  const[category,setCategory]=useState("all");
  const[scope,setScope]=useState("all");
  const[busy,setBusy]=useState<string|null>(null);
  const scopes=useMemo(()=>{
    const map=new Map<string,string>();
    items.forEach(d=>{if(d.field_id&&d.fields?.name)map.set(`field:${d.field_id}`,`Tábla: ${d.fields.name}`);else if(d.farm_id&&d.farms?.name)map.set(`farm:${d.farm_id}`,`Gazdaság: ${d.farms.name}`)});
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1],"hu"));
  },[items]);
  const visible=useMemo(()=>items.filter(d=>{
    const q=query.trim().toLocaleLowerCase("hu-HU");
    const hay=[d.title,d.notes,d.file_name,d.fields?.name,d.farms?.name,labels[d.category]].filter(Boolean).join(" ").toLocaleLowerCase("hu-HU");
    const scopeMatch=scope==="all"||(scope.startsWith("field:")&&d.field_id===scope.slice(6))||(scope.startsWith("farm:")&&d.farm_id===scope.slice(5));
    return(category==="all"||d.category===category)&&scopeMatch&&(!q||hay.includes(q));
  }),[items,query,category,scope]);

  async function openDoc(d:any){setBusy(`open-${d.id}`);const supabase=createClient();const{data,error}=await supabase.storage.from("documents").createSignedUrl(d.storage_path,60);setBusy(null);if(error||!data?.signedUrl){alert("A dokumentum megnyitása sikertelen.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")}
  async function deleteDoc(d:any){if(!confirm(`Biztosan törlöd ezt a dokumentumot?\n\n${d.title}`))return;setBusy(`delete-${d.id}`);const supabase=createClient();const row=await supabase.from("documents").delete().eq("id",d.id);if(row.error){alert(`A dokumentum törlése sikertelen: ${row.error.message}`);setBusy(null);return}const storage=await supabase.storage.from("documents").remove([d.storage_path]);if(storage.error)console.warn("A dokumentum rekordja törölve, de a fájl takarítása sikertelen:",storage.error.message);setBusy(null);router.refresh()}

  return <>
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}><span>⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Keresés név, megjegyzés, gazdaság vagy tábla alapján..."/></div>
      <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Minden kategória</option><option value="talajvizsgalat">Talajvizsgálat</option><option value="permetezes">Permetezés</option><option value="szerzodes">Szerződés</option><option value="szamla">Számla</option><option value="foto">Fotó</option><option value="egyeb">Egyéb</option></select>
      <select value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Minden gazdaság és tábla</option>{scopes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    </div>
    <div className={styles.resultLine}><span>{visible.length} találat</span>{(query||category!=="all"||scope!=="all")&&<button type="button" onClick={()=>{setQuery("");setCategory("all");setScope("all")}}>Szűrők törlése</button>}</div>
    {!visible.length?<div className={styles.empty}><div><div className={styles.emptyIcon}>▱</div><strong>{items.length?"Nincs a szűrésnek megfelelő dokumentum.":"Még nincs feltöltött dokumentum."}</strong><p>{items.length?"Módosítsd a keresést vagy a szűrőket.":"Tölts fel egy dokumentumot a fenti űrlap segítségével."}</p></div></div>:<div className={styles.list}>{visible.map(d=><article className={styles.card} key={d.id}><div className={styles.cardTop}><div className={styles.fileIcon}>▤</div><div className={styles.title}><strong>{d.title}</strong><small>{new Date(d.created_at).toLocaleDateString("hu-HU")} · {d.file_name}{d.file_size?` · ${fileSize(d.file_size)}`:""}</small></div><span className={styles.badge}>{labels[d.category]||"Dokumentum"}</span></div><div className={styles.meta}>{d.fields?.name?<span>Földtábla: <b>{d.fields.name}</b></span>:d.farms?.name?<span>Gazdaság: <b>{d.farms.name}</b></span>:null}{d.notes&&<p>{d.notes}</p>}</div><div className={styles.actions}><button type="button" className="btn btn-secondary" onClick={()=>openDoc(d)} disabled={busy===`open-${d.id}`}>{busy===`open-${d.id}`?"Megnyitás…":"Megnyitás"}</button><button type="button" className={styles.deleteButton} onClick={()=>deleteDoc(d)} disabled={busy===`delete-${d.id}`}>{busy===`delete-${d.id}`?"Törlés…":"Törlés"}</button></div></article>)}</div>}
  </>;
}