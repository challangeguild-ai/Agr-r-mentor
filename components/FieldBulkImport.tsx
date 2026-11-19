"use client";

import {useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {importFarmFields} from "@/app/admin/bulk-field-actions";
import {fieldFileCandidates} from "@/lib/fieldFileCandidates";
import {parseFieldGeometry,type FieldGeometry} from "@/lib/fieldGeometry";
import {estimatedFieldHectares,MAX_BULK_FIELDS,prepareFieldBatch} from "@/lib/fieldBatchImport";

type Farm={id:string;name:string};
type ExistingField={farm_id:string;name:string;boundary_geojson:unknown};
type Candidate={id:string;name:string;geometry:FieldGeometry;area:number;selected:boolean};

function outlinePath(geometry:FieldGeometry){
  const polys=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
  const rings=polys.flatMap(p=>p);
  const points=rings.flat();
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const spanX=Math.max(maxX-minX,1e-9),spanY=Math.max(maxY-minY,1e-9);
  const scale=Math.min(180/spanX,100/spanY);
  const offsetX=10+(180-spanX*scale)/2,offsetY=10+(100-spanY*scale)/2;
  return rings.map(ring=>ring.map(([lng,lat],i)=>`${i===0?"M":"L"}${(offsetX+(lng-minX)*scale).toFixed(2)},${(offsetY+(maxY-lat)*scale).toFixed(2)}`).join(" ")+" Z").join(" ");
}

async function loadShapeParser(){
  if(typeof window.shp==="function")return window.shp;
  await new Promise<void>((resolve,reject)=>{
    const src="https://unpkg.com/shpjs@6.2.0/dist/shp.min.js";
    const existing=document.querySelector(`script[src="${src}"]`) as HTMLScriptElement|null;
    const script=existing||document.createElement("script");
    if(existing?.dataset.loaded==="1"){
      reject(new Error("A SHP-olvasó nem indult el. Használj GeoJSON-t, vagy frissítsd az oldalt."));return;
    }
    const cleanup=()=>{script.removeEventListener("load",done);script.removeEventListener("error",failed)};
    const done=()=>{script.dataset.loaded="1";cleanup();resolve()};
    const failed=()=>{cleanup();script.remove();reject(new Error("A ZIP/SHP-olvasó most nem tölthető be. GeoJSON import továbbra is elérhető."))};
    script.addEventListener("load",done,{once:true});script.addEventListener("error",failed,{once:true});
    if(!existing){script.src=src;script.async=true;document.body.appendChild(script)}
  });
  if(typeof window.shp!=="function")throw new Error("A SHP-olvasó nem áll rendelkezésre.");
  return window.shp;
}

export function FieldBulkImport({farms,existingFields}:{farms:Farm[];existingFields:ExistingField[]}){
  const router=useRouter();
  const[farmId,setFarmId]=useState(farms[0]?.id||"");
  const[candidates,setCandidates]=useState<Candidate[]>([]);
  const[activeId,setActiveId]=useState("");
  const[filename,setFilename]=useState("");
  const[loading,setLoading]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState<{saved:number;firstId:string}|null>(null);

  const selected=useMemo(()=>candidates.filter(c=>c.selected),[candidates]);
  const active=candidates.find(c=>c.id===activeId)||candidates[0];
  const check=useMemo(()=>{
    if(!selected.length)return "Jelölj ki legalább egy táblát.";
    try{
      prepareFieldBatch(selected.map(c=>({name:c.name,geometry:c.geometry})),existingFields.filter(f=>f.farm_id===farmId).map(f=>({name:f.name,geometry:f.boundary_geojson})));
      return "";
    }catch(err){return err instanceof Error?err.message:"Nem megfelelő táblaadatok."}
  },[selected,existingFields,farmId]);

  async function onFile(file:File){
    setError("");setSuccess(null);setCandidates([]);setActiveId("");setFilename("");
    const zip=/\.zip$/i.test(file.name),json=/\.(geojson|json)$/i.test(file.name);
    if(!zip&&!json){setError("GeoJSON (.geojson, .json) vagy SHP-adatokat tartalmazó ZIP (.zip) szükséges.");return}
    if(file.size>(zip?8_000_000:2_000_000)){setError(zip?"A ZIP legfeljebb 8 MB lehet.":"A GeoJSON legfeljebb 2 MB lehet.");return}
    setLoading(true);
    try{
      let payload:unknown;
      if(zip){const parser=await loadShapeParser();payload=await parser(await file.arrayBuffer())}
      else{try{payload=JSON.parse(await file.text())}catch{throw new Error("A GeoJSON fájl nem érvényes JSON.")}}
      const rows=fieldFileCandidates(payload).map((row,i)=>{
        const checked=parseFieldGeometry(row.geometry);
        return {id:row.id,name:row.label||`Földtábla ${i+1}`,geometry:checked.geometry,area:estimatedFieldHectares(checked.geometry),selected:i<MAX_BULK_FIELDS};
      });
      setCandidates(rows);setActiveId(rows[0].id);setFilename(file.name);
    }catch(err){setError(err instanceof Error?err.message:"A térképi fájl nem dolgozható fel.")}
    finally{setLoading(false)}
  }

  function edit(id:string,changes:Partial<Candidate>){setCandidates(list=>list.map(c=>c.id===id?{...c,...changes}:c));setSuccess(null)}
  async function save(){
    if(!farmId||check||saving)return;
    setSaving(true);setError("");setSuccess(null);
    try{
      const result=await importFarmFields(farmId,selected.map(c=>({name:c.name,geometry:c.geometry})));
      setSuccess(result);setCandidates([]);setFilename("");router.refresh();
    }catch(err){setError(`${err instanceof Error?err.message:"Az import nem sikerült."} Ha a kapcsolat a mentés után szakadt meg, az újrapróbálás előtt ellenőrizd a táblalistát.`)}
    finally{setSaving(false)}
  }

  return <details className="panel" style={{marginTop:14,marginBottom:14}} data-help-block="advisor-map-bulk-import">
    <summary style={{cursor:"pointer",fontWeight:800,fontSize:16}}>Több földtábla feltöltése egy fájlból (GeoJSON / SHP ZIP)</summary>
    <p style={{color:"#526255",marginTop:9}}>Ha már van digitális táblahatár-fájlod, egyszerre több szabálytalan poligont vehetsz fel. Nem kell helyrajzi számot vagy minden adatot megadni. A határok és a területek tájékoztató jellegűek, nem földhivatali hiteles adatok.</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginTop:14}}>
      <label style={{display:"grid",gap:5,flex:"1 1 210px"}}><strong>Gazdaság</strong><select value={farmId} disabled={saving||loading} onChange={event=>{setFarmId(event.target.value);setSuccess(null)}} style={{padding:11,borderRadius:9,border:"1px solid #cad7cd",width:"100%"}}>{farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label style={{display:"grid",gap:5,flex:"2 1 230px"}}><strong>Határfájl kiválasztása</strong><input aria-label="Földtáblák GeoJSON vagy SHP ZIP fájlja" type="file" accept=".geojson,.json,.zip" disabled={saving||loading||!farmId} onChange={event=>{const file=event.target.files?.[0];if(file)void onFile(file);event.target.value=""}} style={{maxWidth:"100%"}}/></label>
    </div>
    {loading&&<p role="status" style={{marginTop:10}}>A fájl feldolgozása…</p>}
    {error&&<p className="error-box" role="alert" style={{marginTop:12}}>{error}</p>}
    {success&&<p role="status" style={{marginTop:12,padding:12,background:"#e1f1e4",borderRadius:8}}><strong>{success.saved} földtábla létrejött.</strong> <Link href={`/admin/map?field=${success.firstId}`}>Az első megtekintése →</Link></p>}
    {!!candidates.length&&<div style={{marginTop:14}}>
      <p><strong>{filename}</strong> · {candidates.length} terület, ebből {selected.length} kijelölve (maximum {MAX_BULK_FIELDS}). A név szerkeszthető. A mentésig semmit nem rögzítünk.</p>
      {candidates.length>MAX_BULK_FIELDS&&<p style={{color:"#a56406"}}>A fájl {MAX_BULK_FIELDS}-nél több táblát tartalmaz. Az első {MAX_BULK_FIELDS} van kijelölve; a többiből külön importot indíthatsz.</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:14,marginTop:10}}>
        <div style={{maxHeight:360,overflowY:"auto",border:"1px solid #d8e2d9",borderRadius:10,padding:9}}>
          {candidates.map((c,i)=><div key={c.id} style={{display:"flex",gap:9,alignItems:"center",padding:"7px 4px",borderBottom:"1px solid #eef1ed",background:active?.id===c.id?"#edf6eb":undefined}}>
            <input type="checkbox" checked={c.selected} aria-label={`${i+1}. tábla importálása`} onChange={e=>edit(c.id,{selected:e.target.checked})} disabled={saving||(!c.selected&&selected.length>=MAX_BULK_FIELDS)}/>
            <button type="button" className="ghost-btn" onClick={()=>setActiveId(c.id)} style={{flex:1,textAlign:"left",whiteSpace:"normal",padding:7}}><strong>{c.name}</strong><small style={{display:"block"}}>{c.area.toLocaleString("hu-HU")} ha · előnézet</small></button>
          </div>)}
        </div>
        <div>
          {active&&<><label style={{display:"grid",gap:5}}><strong>A kiválasztott terület neve</strong><input value={active.name} onChange={event=>edit(active.id,{name:event.target.value})} maxLength={120} disabled={saving} style={{borderRadius:9,padding:10,border:"1px solid #cad7cd",width:"100%"}}/></label>
            <svg viewBox="0 0 200 120" role="img" aria-label={`A(z) ${active.name} táblahatárának vázlatos előnézete`} style={{width:"100%",height:200,background:"#edf3ea",borderRadius:10,marginTop:8}}><path d={outlinePath(active.geometry)} fill="#9ecba4" fillRule="evenodd" stroke="#255d35" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            <p style={{color:"#57685c",fontSize:12}}>Alakhelyes vázlat, nem műholdkép. Az import után a térképen ellenőrizd a valós elhelyezkedést és a táblahatárt. A MultiPolygon részei és belső kivágásai megmaradnak.</p></>}
        </div>
      </div>
      {check&&<p className="error-box" role="alert" style={{marginTop:10}}>{check}</p>}
      <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",marginTop:14}}><button type="button" className="btn btn-primary" disabled={saving||!!check||!farmId} onClick={()=>void save()}>{saving?"Táblák mentése…":`${selected.length} földtábla mentése`}</button><span style={{color:"#57685c",fontSize:12}}>A feltöltés nem módosítja a már meglévő táblákat.</span></div>
    </div>}
  </details>;
}
