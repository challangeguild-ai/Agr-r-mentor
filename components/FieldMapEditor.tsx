"use client";

import {useEffect,useRef,useState} from "react";
import {saveFieldMap} from "@/app/fields/[id]/actions";

declare global{interface Window{L:any}}

type Hotspot={lat:number;lng:number;title:string;description?:string|null;severity?:"attention"|"critical"|"good"};
type Props={fieldId:string;lat:number|null;lng:number|null;boundary:any|null;editable:boolean;hotspots?:Hotspot[]};

export function FieldMapEditor({fieldId,lat,lng,boundary,editable,hotspots=[]}:Props){
  const mapRef=useRef<HTMLDivElement|null>(null);
  const mapInstance=useRef<any>(null);
  const drawnLayer=useRef<any>(null);
  const markerRef=useRef<any>(null);
  const[centerLat,setCenterLat]=useState(lat??47.2);
  const[centerLng,setCenterLng]=useState(lng??19.5);
  const[geojson,setGeojson]=useState(boundary?JSON.stringify(boundary):"");
  const[ready,setReady]=useState(false);

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
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap közreműködők'}).addTo(map);
      const group=new L.FeatureGroup().addTo(map);drawnLayer.current=group;
      if(boundary){const layer=L.geoJSON(boundary,{style:{color:"#2f7430",weight:3,fillColor:"#5c9a46",fillOpacity:.18}}).addTo(group);try{map.fitBounds(layer.getBounds(),{padding:[25,25]})}catch{}}
      if(lat!=null&&lng!=null){markerRef.current=L.marker([lat,lng]).addTo(map)}
      hotspots.forEach(h=>{if(!Number.isFinite(h.lat)||!Number.isFinite(h.lng))return;const color=h.severity==="critical"?"#c93832":h.severity==="attention"?"#d89d24":"#3f8a48";const m=L.circleMarker([h.lat,h.lng],{radius:10,color:"#fff",weight:3,fillColor:color,fillOpacity:1}).addTo(map);m.bindPopup(`<strong>${h.title}</strong>${h.description?`<br><small>${h.description}</small>`:""}<br><small>GPS: ${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}</small>`)});
      if(editable){
        const drawControl=new L.Control.Draw({edit:{featureGroup:group,remove:true},draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true}}});map.addControl(drawControl);
        map.on(L.Draw.Event.CREATED,(e:any)=>{group.clearLayers();group.addLayer(e.layer);const g=e.layer.toGeoJSON().geometry;setGeojson(JSON.stringify(g));const c=e.layer.getBounds().getCenter();setCenterLat(c.lat);setCenterLng(c.lng);if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker([c.lat,c.lng]).addTo(map)});
        map.on(L.Draw.Event.EDITED,()=>{const layers=group.getLayers();if(!layers.length){setGeojson("");return}const l=layers[0];const g=l.toGeoJSON().geometry;setGeojson(JSON.stringify(g));const c=l.getBounds().getCenter();setCenterLat(c.lat);setCenterLng(c.lng)});
        map.on(L.Draw.Event.DELETED,()=>setGeojson(""));
        map.on("click",(e:any)=>{if(group.getLayers().length)return;setCenterLat(e.latlng.lat);setCenterLng(e.latlng.lng);if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker(e.latlng).addTo(map)});
      }
      setReady(true);
    })().catch(console.error);
    return()=>{cancelled=true;if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}};
  },[]);

  return <section className="panel field-map-panel">
    <div className="panel-heading"><div><span className="eyebrow">TÉRKÉP</span><h2>Földtábla helye és határa</h2></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{boundary&&<span className="user-pill">Táblahatár rögzítve</span>}{hotspots.length>0&&<span className="user-pill">● {hotspots.length} GPS problémagóc</span>}</div></div>
    <div ref={mapRef} style={{height:420,width:"100%",borderRadius:12,overflow:"hidden",background:"#e7ece7"}}/>
    {!ready&&<p style={{color:"#6f7c74",fontSize:12}}>Térkép betöltése…</p>}
    {hotspots.length>0&&<p style={{margin:"10px 0 0",color:"#6f7c74",fontSize:12}}>A színes pontok helyszíni GPS-szel rögzített problémagócokat jelölnek. Kattints a pontra a részletekért.</p>}
    {editable?<form action={saveFieldMap} style={{display:"grid",gap:10,marginTop:14}}>
      <input type="hidden" name="field_id" value={fieldId}/><input type="hidden" name="center_lat" value={centerLat}/><input type="hidden" name="center_lng" value={centerLng}/><input type="hidden" name="boundary_geojson" value={geojson}/>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}><span className="user-pill">{centerLat.toFixed(6)}, {centerLng.toFixed(6)}</span><small style={{color:"#6f7c74"}}>Kattints a térképre a középpont megadásához, vagy a bal oldali rajzeszközzel rajzold körbe a táblát.</small></div>
      <button className="btn btn-primary" type="submit" style={{justifySelf:"start"}}>Térképi adatok mentése</button>
    </form>:<p style={{marginTop:12,color:"#6f7c74",fontSize:12}}>{boundary?"A rögzített táblahatár megjelenik a térképen.":lat!=null&&lng!=null?"A tábla rögzített térképi helye látható.":"Ehhez a táblához még nincs térképi hely rögzítve."}</p>}
  </section>
}
