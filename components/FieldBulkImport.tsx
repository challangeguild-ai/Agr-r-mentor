"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {importFarmFields} from "@/app/admin/bulk-field-actions";
import {fieldFileCandidates} from "@/lib/fieldFileCandidates";
import {parseFieldGeometry,type FieldGeometry} from "@/lib/fieldGeometry";
import {estimatedFieldHectares,MAX_BULK_FIELDS,planFieldBatch} from "@/lib/fieldBatchImport";
import {fieldLocationHint} from "@/lib/fieldLocationHint";

type Farm={id:string;name:string};
type ExistingField={id:string;farm_id:string;name:string;boundary_geojson:unknown};
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

let leafletLoading:Promise<void>|null=null;
function ensureLeaflet(){
  if(window.L)return Promise.resolve();
  if(leafletLoading)return leafletLoading;
  leafletLoading=new Promise<void>((resolve,reject)=>{
    const css="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const js="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    if(!document.querySelector(`link[href="${css}"]`)){
      const link=document.createElement("link");link.rel="stylesheet";link.href=css;document.head.appendChild(link);
    }
    const old=document.querySelector(`script[src="${js}"]`) as HTMLScriptElement|null;
    const script=old||document.createElement("script");
    const cleanup=()=>{clearTimeout(timer);script.removeEventListener("load",done);script.removeEventListener("error",failed)};
    const done=()=>{cleanup();window.L?resolve():reject(new Error("A térképmodul nem indult el."))};
    const failed=()=>{cleanup();script.remove();reject(new Error("A térképmodul nem tölthető be."))};
    const timer=setTimeout(failed,12_000);
    script.addEventListener("load",done,{once:true});script.addEventListener("error",failed,{once:true});
    if(!old){script.src=js;script.async=true;document.body.appendChild(script)}
    else if(window.L)done();
  }).catch(error=>{leafletLoading=null;throw error});
  return leafletLoading;
}

/** Georeferenced preview: all polygons and holes, not only the first exterior ring. */
function FieldSatellitePreview({geometry}:{geometry:FieldGeometry}){
  const element=useRef<HTMLDivElement|null>(null);
  const[error,setError]=useState("");
  const[ready,setReady]=useState(false);
  const[tileNotice,setTileNotice]=useState("");
  const[noTiles,setNoTiles]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    let map:any=null;
    (async()=>{
      await ensureLeaflet();
      if(cancelled||!element.current)return;
      const L=window.L;
      map=L.map(element.current,{zoomControl:true,scrollWheelZoom:false});
      const satellite=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles © Esri"});
      const street=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
      let satelliteFailures=0,streetFailures=0;
      satellite.on("tileerror",()=>{
        if(++satelliteFailures===3&&!cancelled){
          setTileNotice("A műholdkép most nem érhető el. Utcatérképre váltottunk; a táblahatár helye továbbra is ellenőrizhető.");
          if(map.hasLayer(satellite)){map.removeLayer(satellite);street.addTo(map)}
        }
      });
      street.on("tileerror",()=>{
        if(++streetFailures===3&&!cancelled){
          setTileNotice("A térképi háttérrétegek nem érhetők el. Az alakvázlatot továbbra is megmutatjuk.");setNoTiles(true);
        }
      });
      satellite.addTo(map);
      L.control.layers({"Műholdkép":satellite,"Utcatérkép":street},undefined,{position:"topright",collapsed:true}).addTo(map);
      const boundary=L.geoJSON(geometry,{style:{color:"#f8de54",weight:3,fillColor:"#397b41",fillOpacity:.22}}).addTo(map);
      const bounds=boundary.getBounds();
      if(!bounds.isValid())throw new Error("A megadott területnek nincs értelmezhető térképi kiterjedése.");
      map.fitBounds(bounds,{padding:[24,24],maxZoom:17});
      window.requestAnimationFrame(()=>{if(!cancelled)map?.invalidateSize()});
      setReady(true);
    })().catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:"A térképi előnézet nem érhető el.")});
    return()=>{cancelled=true;if(map){map.remove();map=null}};
  },[geometry]);
  return <div style={{position:"relative",marginTop:8}}>
    <div ref={element} aria-label="Térképi előnézet, a kiválasztott táblahatár valós földrajzi helyén" role="region" style={{height:275,width:"100%",background:"#e4eade",borderRadius:10,overflow:"hidden"}}/>
    {!ready&&!error&&<p role="status" style={{fontSize:12,color:"#647268"}}>Műholdas térkép betöltése…</p>}
    {tileNotice&&<p role="status" style={{padding:9,background:"#fff7e8",fontSize:12,borderRadius:8}}>{tileNotice}</p>}
    {(error||noTiles)&&<div role="status" style={{padding:9,borderRadius:8,background:"#fff7e8"}}><p style={{fontSize:12}}>{error||"A térképi háttér nem tölthető be."} A fájl alakvázlata ettől függetlenül ellenőrizhető:</p><svg viewBox="0 0 200 120" role="img" aria-label="A táblahatár alakvázlata" style={{width:"100%",height:130,background:"#edf3ea",borderRadius:8}}><path d={outlinePath(geometry)} fill="#9ecba4" fillRule="evenodd" stroke="#255d35" strokeWidth="1.6"/></svg></div>}
  </div>;
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
  const[success,setSuccess]=useState<{saved:number;already:number;firstId:string}|null>(null);

  const selected=useMemo(()=>candidates.filter(c=>c.selected),[candidates]);
  const active=candidates.find(c=>c.id===activeId)||candidates[0];
  const activeGeometry=active?.geometry;
  const activeStats=useMemo(()=>activeGeometry?parseFieldGeometry(activeGeometry).stats:null,[activeGeometry]);
  const locationHint=activeStats?fieldLocationHint(activeStats.centerLng,activeStats.centerLat):null;
  const validation=useMemo(()=>{
    if(!selected.length)return {error:"Jelölj ki legalább egy táblát.",newCount:0,alreadyCount:0};
    try{
      const plan=planFieldBatch(selected.map(c=>({name:c.name,geometry:c.geometry})),existingFields.filter(f=>f.farm_id===farmId).map(f=>({id:f.id,name:f.name,geometry:f.boundary_geojson})));
      return {error:"",newCount:plan.toCreate.length,alreadyCount:plan.already.length};
    }catch(err){return {error:err instanceof Error?err.message:"Nem megfelelő táblaadatok.",newCount:0,alreadyCount:0}}
  },[selected,existingFields,farmId]);
  const check=validation.error;

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
    {success&&<p role="status" style={{marginTop:12,padding:12,background:"#e1f1e4",borderRadius:8}}><strong>{success.saved} új földtábla létrejött; {success.already} már korábban is szerepelt, ezért nem került be újra.</strong> <Link href={`/admin/map?field=${success.firstId}`}>Az egyik megtekintése →</Link></p>}
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
            <FieldSatellitePreview key={active.id} geometry={active.geometry}/>
            {activeStats&&<p style={{color:"#57685c",fontSize:12,marginTop:7}}>Középpont: {activeStats.centerLat.toFixed(5)}° É, {activeStats.centerLng.toFixed(5)}° K · {activeStats.vertices} töréspont · {activeStats.polygons} poligon · {activeStats.holes} belső kivágás.</p>}
            {locationHint&&<p role="alert" style={{padding:10,borderRadius:8,background:"#fff2d9",color:"#81520b",fontSize:12}}>{locationHint}</p>}
            <p style={{color:"#57685c",fontSize:12}}>A műholdképen ellenőrizd, hogy a határ tényleg a megfelelő művelt területre esik. A forrás nem hiteles földhivatali adat; a poligon minden eredeti töréspontja és különálló része megmarad.</p></>}
        </div>
      </div>
      {check?<p className="error-box" role="alert" style={{marginTop:10}}>{check}</p>:validation.alreadyCount>0&&<p style={{fontSize:12,color:"#526255",marginTop:10}}>{validation.alreadyCount} táblahatár már pontosan így szerepel a gazdaságban. Ezeket a rendszer nem menti kétszer.</p>}
      <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",marginTop:14}}><button type="button" className="btn btn-primary" disabled={saving||!!check||!farmId} onClick={()=>void save()}>{saving?"Táblák mentése…":validation.newCount?`${validation.newCount} új tábla mentése`:"Meglévő táblák ellenőrzése"}</button><span style={{color:"#57685c",fontSize:12}}>A feltöltés nem módosítja a már meglévő táblákat.</span></div>
    </div>}
  </details>;
}
