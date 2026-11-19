"use client";

import {useEffect,useRef,useState} from "react";
import {saveFieldMap} from "@/app/fields/[id]/actions";
import {BlockHelpButton} from "@/components/GuidedTour";
import {parseFieldGeometry,parseFieldGeometryText} from "@/lib/fieldGeometry";
import {osmFieldSuggestions,type OsmFieldSuggestion} from "@/lib/osmFieldBoundary";

declare global{interface Window{L:any}}

type Hotspot={lat:number;lng:number;title:string;description?:string|null;severity?:"attention"|"critical"|"good"};
type Props={fieldId:string;lat:number|null;lng:number|null;boundary:any|null;editable:boolean;geometrySource?:string|null;hotspots?:Hotspot[];compact?:boolean};

export function FieldMapEditor({fieldId,lat,lng,boundary,editable,geometrySource="manual",hotspots=[],compact=false}:Props){
  const mapRef=useRef<HTMLDivElement|null>(null);
  const mapInstance=useRef<any>(null);
  const drawnLayer=useRef<any>(null);
  const markerRef=useRef<any>(null);
  const osmAbortRef=useRef<AbortController|null>(null);
  const[centerLat,setCenterLat]=useState(lat??47.2);
  const[centerLng,setCenterLng]=useState(lng??19.5);
  const[geojson,setGeojson]=useState(boundary?JSON.stringify(boundary):"");
  const[ready,setReady]=useState(false);
  const[boundarySource,setBoundarySource]=useState(geometrySource||"manual");
  const[importMessage,setImportMessage]=useState("");
  const[importError,setImportError]=useState("");
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
          if(!parts.length){setGeojson("");setBoundarySource("manual");setImportMessage("");setOsmCandidates([]);return}
          const rings=parts.flatMap((g:any)=>g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[]);
          const g=rings.length===1?{type:"Polygon",coordinates:rings[0]}:{type:"MultiPolygon",coordinates:rings};
          try{
            const checked=parseFieldGeometry(g);
            setGeojson(JSON.stringify(checked.geometry));setBoundarySource("manual");setPointChosen(true);setOsmCandidates([]);setOsmMessage("");
            setImportMessage(`Kézzel szerkesztett táblahatár: ${checked.stats.vertices} töréspont.`);setImportError("");
            const c=group.getBounds().getCenter();setCenterLat(c.lat);setCenterLng(c.lng);
            if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker([c.lat,c.lng]).addTo(map);
          }catch(error){setImportError(error instanceof Error?error.message:"Hibás határgeometria.")}
        };
        map.on(L.Draw.Event.CREATED,(e:any)=>{group.clearLayers();group.addLayer(e.layer);syncDrawnLayers()});
        map.on(L.Draw.Event.EDITED,syncDrawnLayers);
        map.on(L.Draw.Event.DELETED,syncDrawnLayers);
        map.on("click",(e:any)=>{if(group.getLayers().length)return;osmAbortRef.current?.abort();setOsmCandidates([]);setOsmMessage("");setPointChosen(true);setCenterLat(e.latlng.lat);setCenterLng(e.latlng.lng);if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker(e.latlng).addTo(map)});
      }
      setReady(true);
    })().catch(console.error);
    return()=>{cancelled=true;osmAbortRef.current?.abort();if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}};
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
    setOsmCandidates([]);setOsmMessage("");setImportError("");
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

  async function importGeoJson(file:File){
    setImportError("");setImportMessage("");
    if(file.size>2_000_000){setImportError("Legfeljebb 2 MB méretű GeoJSON fájl importálható.");return}
    try{
      const {geometry}=parseFieldGeometryText(await file.text());
      previewGeometry(geometry,"external",file.name);
    }catch(error){setImportError(error instanceof Error?error.message:"A GeoJSON importálása nem sikerült.")}
  }

  return <section className={compact?"field-map-panel field-map-panel-compact":"panel field-map-panel"} data-help-block="field-map" data-tour="farmer-field-map">
    {!compact&&<div className="panel-heading"><div><span className="eyebrow">TÉRKÉP</span><h2>Földtábla helye és határa</h2></div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{boundary&&<span className="user-pill">Táblahatár rögzítve</span>}{hotspots.length>0&&<span className="user-pill">● {hotspots.length} GPS problémagóc</span>}<BlockHelpButton label="A földtábla térképének magyarázata" content={{title:"Földtábla helye és határa",body:"A táblához már egyetlen térképi pont is elegendő. Ha szeretnéd, választhatsz közeli OpenStreetMap-határjavaslatot, feltölthetsz GeoJSON fájlt, vagy kézzel is körberajzolhatod. A problémagócok külön jelennek meg.",important:"A határjavaslat nem hiteles földhivatali adat, és a művelt tábla eltérhet a helyrajzi számmal jelölt földrészlettől. Csak az ellenőrzött poligont mentsd; a későbbi GPS-ellenőrzések erre támaszkodhatnak.",example:"Példa: az új tábla belsejére kattintasz, megkeresed az OSM-határjavaslatokat, ellenőrzöd a műholdképen, és egy kattintással előnézetbe emeled. Ha nincs jó javaslat, a helypontot is elmentheted.",steps:["Nagyíts a földtábla környékére.","Kattints a tábla belsejére: a helypont önmagában is elegendő.","Ha van, keress OSM-határjavaslatot, vagy tölts fel GeoJSON fájlt.","A kézi rajzolás és szerkesztés is választható.","Ellenőrizd, hogy a poligon valóban a művelt területet jelöli.","Nyomd meg a Térképi adatok mentése gombot."]}}/></div></div>}
    <div ref={mapRef} style={{height:compact?260:420,width:"100%",borderRadius:compact?9:12,overflow:"hidden",background:"#e7ece7"}}/>
    {!ready&&<p style={{color:"#6f7c74",fontSize:compact?9:12}}>Térkép betöltése…</p>}
    {!compact&&hotspots.length>0&&<p style={{margin:"10px 0 0",color:"#6f7c74",fontSize:12}}>A színes pontok helyszíni GPS-szel rögzített problémagócokat jelölnek. Kattints a pontra a részletekért.</p>}
    {!compact&&editable?<form action={saveFieldMap} style={{display:"grid",gap:10,marginTop:14}}>
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
        <strong>Határvonal importálása fájlból (GeoJSON)</strong>
        <label style={{fontSize:13}}>WGS84 (EPSG:4326) vektoros fájl
          <input aria-label="GeoJSON táblahatárfájl kiválasztása" type="file" accept=".geojson,.json,application/geo+json,application/json" disabled={!ready} onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)await importGeoJson(file)}}/>
        </label>
        <small style={{color:"#526253"}}>A fájl valamennyi töréspontját, a belső kivágásokat és a MultiPolygon részeit megőrizzük. EOV/SHP/GML fájlt előbb WGS84 GeoJSON-ra kell alakítani. A fájl nem bizonyítja önmagában a hivatalos földrészlethatárt.</small>
        {importMessage&&<p role="status" style={{margin:0,color:"#2f7430"}}>{importMessage}</p>}
        {importError&&<p role="alert" style={{margin:0,color:"#b3342b"}}>{importError}</p>}
      </div>
      <button className="btn btn-primary" type="submit" style={{justifySelf:"start"}}>Térképi adatok mentése</button>
    </form>:!compact?<p style={{marginTop:12,color:"#6f7c74",fontSize:12}}>{boundary?"A rögzített táblahatár megjelenik a térképen.":lat!=null&&lng!=null?"A tábla rögzített térképi helye látható.":"Ehhez a táblához még nincs térképi hely rögzítve."}</p>:null}
  </section>
}
