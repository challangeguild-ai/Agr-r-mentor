"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {saveFieldMap} from "@/app/fields/[id]/actions";
import {submitFieldBoundaryProposal} from "@/app/fields/[id]/proposal-actions";
import {BlockHelpButton} from "@/components/GuidedTour";
import {FieldDocumentImport} from "@/components/FieldDocumentImport";
import {parseFieldGeometry,parseFieldGeometryText} from "@/lib/fieldGeometry";
import {osmFieldSuggestions,type OsmFieldSuggestion} from "@/lib/osmFieldBoundary";
import {fieldFileCandidates,type FieldFileCandidate} from "@/lib/fieldFileCandidates";

declare global{interface Window{L:any;shp?: (data:ArrayBuffer)=>Promise<unknown>}}

type Hotspot={lat:number;lng:number;title:string;description?:string|null;severity?:"attention"|"critical"|"good"};
type Props={fieldId:string;lat:number|null;lng:number|null;boundary:any|null;editable:boolean;geometrySource?:string|null;hotspots?:Hotspot[];compact?:boolean;proposalMode?:boolean};

export function FieldMapEditor({fieldId,lat,lng,boundary,editable,geometrySource="manual",hotspots=[],compact=false,proposalMode=false}:Props){
  const router=useRouter();
  const mapRef=useRef<HTMLDivElement|null>(null);
  const mapInstance=useRef<any>(null);
  const drawnLayer=useRef<any>(null);
  const markerRef=useRef<any>(null);
  const osmAbortRef=useRef<AbortController|null>(null);
  const documentMapClickRef=useRef<((lat:number,lng:number)=>void)|null>(null);
  const documentAnchorMarkers=useRef<any[]>([]);
  const captureDocumentMapClick=useCallback((callback:((lat:number,lng:number)=>void)|null)=>{documentMapClickRef.current=callback},[]);
  const showDocumentMapAnchors=useCallback((points:{lat:number;lng:number}[])=>{
    const map=mapInstance.current,L=window.L;
    if(!map||!L)return;
    documentAnchorMarkers.current.forEach(marker=>map.removeLayer(marker));documentAnchorMarkers.current=[];
    points.forEach((p,index)=>{
      const marker=L.circleMarker([p.lat,p.lng],{radius:9,color:"#fff",weight:2,fillColor:"#005ecc",fillOpacity:1})
        .bindTooltip(`Illesztési pont ${index+1}`,{permanent:true,direction:"top"}).addTo(map);
      documentAnchorMarkers.current.push(marker);
    });
  },[]);
  const[centerLat,setCenterLat]=useState(lat??47.2);
  const[centerLng,setCenterLng]=useState(lng??19.5);
  const[geojson,setGeojson]=useState(boundary?JSON.stringify(boundary):"");
  const[ready,setReady]=useState(false);
  const[boundarySource,setBoundarySource]=useState(proposalMode?(geometrySource==="external"?"external":"manual"):(geometrySource||"manual"));
  const[proposalSaving,setProposalSaving]=useState(false);
  const[proposalFeedback,setProposalFeedback]=useState<{ok:boolean;message:string}|null>(null);
  const[importMessage,setImportMessage]=useState("");
  const[importError,setImportError]=useState("");
  const[fileCandidates,setFileCandidates]=useState<FieldFileCandidate[]>([]);
  const[fileLoading,setFileLoading]=useState(false);
  const[pointChosen,setPointChosen]=useState((lat!=null&&lng!=null)||!!boundary);
  const[osmLoading,setOsmLoading]=useState(false);
  const[osmCandidates,setOsmCandidates]=useState<OsmFieldSuggestion[]>([]);
  const[osmMessage,setOsmMessage]=useState("");

  useEffect(()=>{
    function loadCss(href:string){if(document.querySelector(`link[href="${href}"]`))return;const l=document.createElement("link");l.rel="stylesheet";l.href=href;document.head.appendChild(l)}
    function loadScript(src:string){return new Promise<void>((resolve,reject)=>{const found=document.querySelector(`script[src="${src}"]`) as HTMLScriptElement|null;if(found){if((found as any).dataset.loaded==="1")resolve();else found.addEventListener("load",()=>resolve(),{once:true});return}const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>{(s as any).dataset.loaded="1";resolve()};s.onerror=()=>reject(new Error("A térképi modul nem tölthető be."));document.body.appendChild(s)})}
    let cancelled=false;
    (async()=>{
      loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      loadCss("https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css");
      await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
      await loadScript("https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js");
      if(cancelled||!mapRef.current||mapInstance.current)return;
      const L=window.L;const map=L.map(mapRef.current).setView([centerLat,centerLng],lat&&lng?15:7);mapInstance.current=map;
      const satellite=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles © Esri"});const street=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});satellite.addTo(map);L.control.layers({"Műhold":satellite,"Utcatérkép":street},undefined,{position:"topright",collapsed:false}).addTo(map);
      const group=new L.FeatureGroup().addTo(map);drawnLayer.current=group;
      if(boundary){const layer=L.geoJSON(boundary,{style:{color:"#2f7430",weight:3,fillColor:"#5c9a46",fillOpacity:.18}});layer.eachLayer((part:any)=>group.addLayer(part));try{map.fitBounds(group.getBounds(),{padding:[25,25]});if(lat==null||lng==null){const c=group.getBounds().getCenter();setCenterLat(c.lat);setCenterLng(c.lng)}}catch{}}
      if(lat!=null&&lng!=null){markerRef.current=L.marker([lat,lng]).addTo(map)}
      hotspots.forEach(h=>{if(!Number.isFinite(h.lat)||!Number.isFinite(h.lng))return;const color=h.severity==="critical"?"#c93832":h.severity==="attention"?"#d89d24":"#3f8a48";const m=L.circleMarker([h.lat,h.lng],{radius:10,color:"#fff",weight:3,fillColor:color,fillOpacity:1}).addTo(map);m.bindPopup(`<strong>${h.title}</strong>${h.description?`<br><small>${h.description}</small>`:""}<br><small>GPS: ${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}</small>`)});
      if(editable){
        const drawControl=new L.Control.Draw({edit:{featureGroup:group,remove:true},draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true}}});map.addControl(drawControl);
        const syncDrawnLayers=()=>{
          const parts=group.getLayers().map((layer:any)=>layer.toGeoJSON().geometry).filter(Boolean);
          if(!parts.length){setGeojson("");setBoundarySource("manual");setImportMessage("");setOsmCandidates([]);setFileCandidates([]);return}
          const rings=parts.flatMap((g:any)=>g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[]);
          const g=rings.length===1?{type:"Polygon",coordinates:rings[0]}:{type:"MultiPolygon",coordinates:rings};
          try{
            const checked=parseFieldGeometry(g);
            setGeojson(JSON.stringify(checked.geometry));setBoundarySource("manual");setPointChosen(true);setOsmCandidates([]);setOsmMessage("");setFileCandidates([]);
            setImportMessage(`Kézzel szerkesztett táblahatár: ${checked.stats.vertices} töréspont.`);setImportError("");
            const c=group.getBounds().getCenter();setCenterLat(c.lat);setCenterLng(c.lng);
            if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker([c.lat,c.lng]).addTo(map);
          }catch(error){setImportError(error instanceof Error?error.message:"Hibás határgeometria.")}
        };
        map.on(L.Draw.Event.CREATED,(e:any)=>{group.clearLayers();group.addLayer(e.layer);syncDrawnLayers()});
        map.on(L.Draw.Event.EDITED,syncDrawnLayers);
        map.on(L.Draw.Event.DELETED,syncDrawnLayers);
        map.on("click",(e:any)=>{if(documentMapClickRef.current){documentMapClickRef.current(e.latlng.lat,e.latlng.lng);return}if(group.getLayers().length)return;osmAbortRef.current?.abort();setOsmCandidates([]);setOsmMessage("");setPointChosen(true);setCenterLat(e.latlng.lat);setCenterLng(e.latlng.lng);if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker(e.latlng).addTo(map)});
      }
      setReady(true);
    })().catch(console.error);
    return()=>{cancelled=true;osmAbortRef.current?.abort();documentMapClickRef.current=null;documentAnchorMarkers.current=[];if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}};
  },[]);

  function previewGeometry(value:unknown,source:"manual"|"external",description:string){
    const {geometry,stats}=parseFieldGeometry(value);
    const L=window.L,group=drawnLayer.current,map=mapInstance.current;
    if(!L||!group||!map)throw new Error("A térkép még nem töltődött be. Próbáld újra.");
    const imported=L.geoJSON(geometry,{style:{color:"#2f7430",weight:3,fillColor:"#5c9a46",fillOpacity:.18}});
    group.clearLayers();imported.eachLayer((part:any)=>group.addLayer(part));
    map.fitBounds(group.getBounds(),{padding:[25,25]});
    const c=group.getBounds().getCenter();
    setCenterLat(c.lat);setCenterLng(c.lng);setGeojson(JSON.stringify(geometry));setBoundarySource(source);setPointChosen(true);
    if(markerRef.current)map.removeLayer(markerRef.current);
    markerRef.current=L.marker([c.lat,c.lng]).addTo(map);
    setOsmCandidates([]);setOsmMessage("");setImportError("");setFileCandidates([]);
    setImportMessage(`${description}: ${stats.vertices} töréspont, ${stats.polygons} poligon, ${stats.holes} belső kivágás. Ellenőrizd a térképen, majd mentsd.`);
  }

  async function findOsmBoundary(){
    if(!pointChosen||!ready||osmLoading)return;
    osmAbortRef.current?.abort();
    const controller=new AbortController();osmAbortRef.current=controller;
    const timeout=setTimeout(()=>controller.abort(),12_000);
    setOsmLoading(true);setOsmMessage("");setOsmCandidates([]);
    try{
      const query=`[out:json][timeout:10];way(around:850,${centerLat.toFixed(6)},${centerLng.toFixed(6)})["landuse"~"^(farmland|meadow|orchard|vineyard)$"];out geom;`;
      const response=await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,{signal:controller.signal,cache:"no-store"});
      if(!response.ok)throw new Error("Az OSM adatforrás most nem válaszol. Próbáld később vagy válassz másik módszert.");
      const matches=osmFieldSuggestions(await response.json(),centerLat,centerLng);
      setOsmCandidates(matches);
      setOsmMessage(matches.length?`${matches.length} lehetséges OSM-határ. Válassz egyet előnézetre; a javaslat nem hivatalos.`:"A megjelölt pontnál nem található önálló OSM-táblapoligon. A fájlimport és a kézi rajzolás továbbra is használható.");
    }catch(error){
      if(!controller.signal.aborted)setOsmMessage(error instanceof Error?error.message:"A határkeresés átmenetileg nem elérhető.");
      else setOsmMessage("A keresés megszakadt. A többi módszer továbbra is elérhető.");
    }finally{
      clearTimeout(timeout);
      if(osmAbortRef.current===controller){osmAbortRef.current=null;setOsmLoading(false)}
    }
  }

  async function loadShapefileParser(){
    if(typeof window.shp==="function")return window.shp;
    await new Promise<void>((resolve,reject)=>{
      const src="https://unpkg.com/shpjs@6.2.0/dist/shp.min.js";
      const already=document.querySelector(`script[src="${src}"]`) as HTMLScriptElement|null;
      const script=already||document.createElement("script");
      if(already&&already.dataset.loaded==="1"){reject(new Error("A SHP-olvasó nem indult el. Próbáld GeoJSON fájllal."));return}
      const onLoad=()=>{script.dataset.loaded="1";cleanup();resolve()};
      const onError=()=>{cleanup();script.remove();reject(new Error("Az ingyenes SHP-olvasó modul nem tölthető be. Próbáld később, vagy használj GeoJSON-t."))};
      const cleanup=()=>{script.removeEventListener("load",onLoad);script.removeEventListener("error",onError)};
      script.addEventListener("load",onLoad,{once:true});
      script.addEventListener("error",onError,{once:true});
      if(!already){script.src=src;script.async=true;document.body.appendChild(script)}
    });
    if(typeof window.shp!=="function")throw new Error("A SHP-olvasó nem indult el. Próbáld GeoJSON fájllal.");
    return window.shp;
  }

  async function importBoundaryFile(file:File){
    setImportError("");setImportMessage("");setFileCandidates([]);
    const zipped=/\\.zip$/i.test(file.name);
    const geoJson=/\\.(geojson|json)$/i.test(file.name);
    if(!zipped&&!geoJson){setImportError("GeoJSON (.geojson/.json) vagy Shape-fájlt tartalmazó ZIP (.zip) választható.");return}
    if(file.size>(zipped?8_000_000:2_000_000)){setImportError(zipped?"Legfeljebb 8 MB-os SHP ZIP csomagot válassz.":"Legfeljebb 2 MB méretű GeoJSON fájl importálható.");return}
    setFileLoading(true);
    try{
      let data:unknown;
      if(zipped){const parse=await loadShapefileParser();data=await parse(await file.arrayBuffer())}
      else{try{data=JSON.parse(await file.text())}catch{throw new Error("A GeoJSON fájl nem érvényes JSON.")}}
      const candidates=fieldFileCandidates(data).map(candidate=>({...candidate,geometry:parseFieldGeometry(candidate.geometry).geometry}));
      if(candidates.length===1)previewGeometry(candidates[0].geometry,"external",`${file.name} · ${candidates[0].label}`);
      else{
        setFileCandidates(candidates);
        setImportMessage(`${file.name}: ${candidates.length} poligon található. Válaszd ki az ehhez a földtáblához tartozót; egyiket sem mentjük automatikusan.`);
      }
    }catch(error){setImportError(error instanceof Error?error.message:"A táblahatár-fájl nem dolgozható fel.")}
    finally{setFileLoading(false)}
  }

  async function handleProposalSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(proposalSaving)return;
    setProposalSaving(true);setProposalFeedback(null);
    try{
      const result=await submitFieldBoundaryProposal(new FormData(event.currentTarget));
      setProposalFeedback(result);
      if(result.ok)router.refresh();
    }catch{setProposalFeedback({ok:false,message:"A javaslat beküldése megszakadt. Próbáld újra."})}
    finally{setProposalSaving(false)}
  }

  return <section className={compact?"field-map-panel field-map-panel-compact":"panel field-map-panel"} data-help-block="field-map" data-tour="farmer-field-map">
    {!compact&&<div className="panel-heading"><div><span className="eyebrow">TÉRKÉP</span><h2>Földtábla helye és határa</h2></div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{boundary&&<span className="user-pill">Táblahatár rögzítve</span>}{hotspots.length>0&&<span className="user-pill">● {hotspots.length} GPS problémagóc</span>}<BlockHelpButton label="A földtábla térképének magyarázata" content={{title:"Földtábla helye és határa",body:"A táblához már egyetlen térképi pont is elegendő. Ha szeretnéd, választhatsz közeli OpenStreetMap-határjavaslatot, feltölthetsz GeoJSON-t vagy ZIP-be csomagolt SHP-fájlt, vagy kézzel is körberajzolhatod. A problémagócok külön jelennek meg.",important:"A határjavaslat nem hiteles földhivatali adat, és a művelt tábla eltérhet a helyrajzi számmal jelölt földrészlettől. Csak az ellenőrzött poligont mentsd; a későbbi GPS-ellenőrzések erre támaszkodhatnak.",example:"Példa: az új tábla belsejére kattintasz, megkeresed az OSM-határjavaslatokat, ellenőrzöd a műholdképen, és egy kattintással előnézetbe emeled. Ha nincs jó javaslat, a helypontot is elmentheted.",steps:["Nagyíts a földtábla környékére.","Kattints a tábla belsejére: a helypont önmagában is elegendő.","Ha van, keress OSM-határjavaslatot, vagy tölts fel GeoJSON/SHP ZIP fájlt.","A kézi rajzolás és szerkesztés is választható.","Ellenőrizd, hogy a poligon valóban a művelt területet jelöli.","Nyomd meg a Térképi adatok mentése gombot."]}}/></div></div>}
    <div ref={mapRef} style={{height:compact?260:420,width:"100%",borderRadius:compact?9:12,overflow:"hidden",background:"#e7ece7"}}/>
    {!ready&&<p style={{color:"#6f7c74",fontSize:compact?9:12}}>Térkép betöltése…</p>}
    {!compact&&hotspots.length>0&&<p style={{margin:"10px 0 0",color:"#6f7c74",fontSize:12}}>A színes pontok helyszíni GPS-szel rögzített problémagócokat jelölnek. Kattints a pontra a részletekért.</p>}
    {!compact&&editable?<form action={proposalMode?undefined:saveFieldMap} onSubmit={proposalMode?handleProposalSubmit:undefined} style={{display:"grid",gap:10,marginTop:14}}>
      <input type="hidden" name="field_id" value={fieldId}/><input type="hidden" name="center_lat" value={pointChosen?centerLat:""}/><input type="hidden" name="center_lng" value={pointChosen?centerLng:""}/><input type="hidden" name="boundary_geojson" value={geojson}/><input type="hidden" name="boundary_source" value={boundarySource}/>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}><span className="user-pill">{pointChosen?`${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`:"Hely nincs megadva"}</span><span className="user-pill">{geojson?"Poligon megjelenítve – mentsd, ha változtattál":pointChosen?"Csak helypont – poligon még nincs":"Még nincs térképi hely"}</span><small style={{color:"#6f7c74"}}>A pont önmagában is menthető. A poligon pontosságát a forrás és az ellenőrzés határozza meg, nem a kitöltött mezők száma.</small></div>
      <div style={{padding:12,border:"1px solid #d7e2d6",borderRadius:10,background:"#f7faf7",display:"grid",gap:8}}>
        <strong>Gyors határjavaslat – nem kötelező</strong>
        <small style={{color:"#526253"}}>Ha nincs kész poligonod, kattints a tábla belsejére a térképen. Megnézzük, szerepel-e ott már körberajzolt mezőgazdasági terület az OpenStreetMapben.</small>
        <button className="btn btn-secondary" type="button" disabled={!ready||!pointChosen||osmLoading} onClick={findOsmBoundary} style={{justifySelf:"start"}}>{osmLoading?"OSM-határ keresése…":"Határjavaslat keresése a megjelölt pontnál"}</button>
        {!pointChosen&&<small style={{color:"#6f7c74"}}>Előbb jelölj meg egy pontot a térképen.</small>}
        {osmMessage&&<p role="status" style={{margin:0,fontSize:12,color:"#526253"}}>{osmMessage}</p>}
        {osmCandidates.length>0&&<div role="group" aria-label="Választható OSM-határjavaslatok" style={{display:"grid",gap:6}}>
          {osmCandidates.map(candidate=><button key={candidate.id} type="button" className="ghost-btn" style={{justifyContent:"space-between",textAlign:"left",whiteSpace:"normal"}} onClick={()=>{try{previewGeometry(candidate.geometry,"external",`OpenStreetMap ${candidate.id}`)}catch(error){setImportError(error instanceof Error?error.message:"A javasolt geometria nem használható.")}}}>{candidate.label} · kb. {candidate.approximateHa.toFixed(2)} ha · {candidate.vertices} pont – Előnézet</button>)}
        </div>}
        <small style={{color:"#526253"}}>Az OSM-határ lehet hiányos vagy több táblát összefogó alakzat. Nem hivatalos pontossági garancia; csak ellenőrzés után mentsd. A keresés sikertelensége nem akadályozza a táblafelvételt. Adatok: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap közreműködői (ODbL)</a>.</small>
      </div>
      <div style={{padding:12,border:"1px solid #d7e2d6",borderRadius:10,background:"#f6faf5",display:"grid",gap:7}}>
        <strong>Saját határfájl feltöltése (GeoJSON vagy SHP ZIP)</strong>
        <label style={{fontSize:13}}>Saját mérés vagy korábban beszerzett poligonfájl
          <input aria-label="GeoJSON vagy SHP ZIP táblahatárfájl kiválasztása" type="file" accept=".geojson,.json,.zip,application/geo+json,application/json,application/zip" disabled={!ready||fileLoading} onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)await importBoundaryFile(file)}}/>
        </label>
        <small style={{color:"#526253"}}>A GeoJSON WGS84 (EPSG:4326) legyen. Az SHP-fájlokat egy ZIP-be csomagold a hozzájuk tartozó .shx, .dbf és .prj állománnyal; a vetületet helyben alakítjuk át. A mobilGAZDA saját mérési exportja is használható lehet. Minden töréspont és belső kivágás megmarad. EOV esetén külön ellenőrizd az elhelyezkedést; GML/DXF még nem fogadható. Nem szükséges fizetős adatszolgáltatás. Korábban vásárolt adat csak megfelelő felhasználási joggal tölthető fel; a teljes ZIP-et nem tároljuk, csak a külön mentett kiválasztott poligont.</small>
        {fileLoading&&<p role="status" style={{margin:0,color:"#526253"}}>Fájl feldolgozása a böngésződben…</p>}
        {importMessage&&<p role="status" style={{margin:0,color:"#2f7430"}}>{importMessage}</p>}
        {fileCandidates.length>0&&<div role="group" aria-label="Fájlból választható poligonok" style={{display:"grid",gap:6}}>{fileCandidates.map(candidate=><button key={candidate.id} type="button" className="ghost-btn" style={{justifyContent:"flex-start",textAlign:"left",whiteSpace:"normal"}} onClick={()=>{try{previewGeometry(candidate.geometry,"external",candidate.label)}catch(error){setImportError(error instanceof Error?error.message:"A választott poligon nem használható.")}}}>{candidate.label} – Előnézet</button>)}</div>}
        {importError&&<p role="alert" style={{margin:0,color:"#b3342b"}}>{importError}</p>}
      </div>
      <FieldDocumentImport ready={ready} onCaptureMapPoint={captureDocumentMapClick} onShowMapAnchors={showDocumentMapAnchors} onPreview={(geometry,description)=>previewGeometry(geometry,"external",description)}/>
      {proposalMode&&<div style={{display:"grid",gap:7}}><label htmlFor={`proposal-note-${fieldId}`} style={{fontWeight:700,fontSize:13}}>Megjegyzés a szaktanácsadónak (nem kötelező)</label><textarea id={`proposal-note-${fieldId}`} name="proposal_note" rows={2} maxLength={1000} placeholder="Pl. a műholdkép és a művelt terület széle között eltérés lehet" style={{width:"100%",padding:10,border:"1px solid #d7e2d6",borderRadius:9,font:"inherit"}}/><small>A javaslat nem kerül fel automatikusan a gazdaság térképére. A szaktanácsadó ellenőrzi, majd elfogadja vagy elutasítja. A helyrajzi szám önmagában nem hitelesíti a határt.</small></div>}
      {proposalFeedback&&<p role={proposalFeedback.ok?"status":"alert"} style={{color:proposalFeedback.ok?"#2f7430":"#b3342b",margin:0}}>{proposalFeedback.message}</p>}
      <button className="btn btn-primary" type="submit" disabled={!ready||!pointChosen||proposalSaving||proposalFeedback?.ok===true} style={{justifySelf:"start"}}>{proposalSaving?"Javaslat küldése…":proposalMode?"Táblahatár-javaslat beküldése":"Térképi adatok mentése"}</button>
    </form>:!compact?<p style={{marginTop:12,color:"#6f7c74",fontSize:12}}>{boundary?"A rögzített táblahatár megjelenik a térképen.":lat!=null&&lng!=null?"A tábla rögzített térképi helye látható.":"Ehhez a táblához még nincs térképi hely rögzítve."}</p>:null}
  </section>
}
