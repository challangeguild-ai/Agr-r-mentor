"use client";

import {useEffect,useRef,useState} from "react";
import {saveFieldBoundary} from "@/app/fields/[id]/map-actions";

declare global { interface Window { L?: any } }

type Geo={type:"Polygon"|"MultiPolygon";coordinates:any[]}|null;

export function FieldBoundaryMap({fieldId,editable,centerLat,centerLng,boundary}:{fieldId:string;editable:boolean;centerLat:number|null;centerLng:number|null;boundary:Geo}){
  const mapEl=useRef<HTMLDivElement|null>(null); const mapRef=useRef<any>(null); const layerRef=useRef<any>(null); const markerRef=useRef<any>(null);
  const [points,setPoints]=useState<[number,number][]>(()=>boundary?.type==="Polygon"?(boundary.coordinates?.[0]||[]).slice(0,-1).map((p:any)=>[Number(p[1]),Number(p[0])]):[]);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");

  useEffect(()=>{
    let cancelled=false;
    async function boot(){
      if(!document.querySelector('link[data-leaflet]')){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.dataset.leaflet="1";document.head.appendChild(link)}
      if(!window.L){await new Promise<void>((resolve,reject)=>{const existing=document.querySelector('script[data-leaflet]') as HTMLScriptElement|null;if(existing){existing.addEventListener("load",()=>resolve(),{once:true});return}const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.dataset.leaflet="1";s.onload=()=>resolve();s.onerror=()=>reject(new Error("A térkép betöltése sikertelen."));document.body.appendChild(s)})}
      if(cancelled||!mapEl.current||mapRef.current)return; const L=window.L; if(!L)return;
      const initial:[number,number]=centerLat!=null&&centerLng!=null?[centerLat,centerLng]:[47.50,19.50];
      const map=L.map(mapEl.current,{zoomControl:true}).setView(initial,centerLat!=null?15:7);mapRef.current=map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:'&copy; OpenStreetMap közreműködők'}).addTo(map);
      if(centerLat!=null&&centerLng!=null)markerRef.current=L.marker([centerLat,centerLng]).addTo(map);
      if(boundary?.type==="Polygon"&&boundary.coordinates?.[0]){const latlngs=boundary.coordinates[0].map((p:any)=>[p[1],p[0]]);layerRef.current=L.polygon(latlngs,{weight:3,fillOpacity:.22}).addTo(map);map.fitBounds(layerRef.current.getBounds(),{padding:[20,20]})}
      if(editable)map.on("click",(e:any)=>setPoints(prev=>[...prev,[e.latlng.lat,e.latlng.lng]]));
    }
    boot().catch(e=>setMessage(e instanceof Error?e.message:"A térkép betöltése sikertelen.")); return()=>{cancelled=true;if(mapRef.current){mapRef.current.remove();mapRef.current=null}}
  },[editable,fieldId]);

  useEffect(()=>{const L=window.L,map=mapRef.current;if(!L||!map)return;if(layerRef.current){map.removeLayer(layerRef.current);layerRef.current=null}if(points.length>=2){layerRef.current=points.length>=3?L.polygon(points,{weight:3,fillOpacity:.22}).addTo(map):L.polyline(points,{weight:3}).addTo(map)}},[points]);

  async function save(){if(points.length<3){setMessage("Legalább 3 pont szükséges a táblahatárhoz.");return}setBusy(true);setMessage("");try{const ring=points.map(([lat,lng])=>[lng,lat]);ring.push(ring[0]);const lat=points.reduce((s,p)=>s+p[0],0)/points.length;const lng=points.reduce((s,p)=>s+p[1],0)/points.length;await saveFieldBoundary(fieldId,lat,lng,{type:"Polygon",coordinates:[ring]});setMessage("Táblahatár elmentve.");const L=window.L,map=mapRef.current;if(L&&map){if(markerRef.current)map.removeLayer(markerRef.current);markerRef.current=L.marker([lat,lng]).addTo(map)}}catch(e){setMessage(e instanceof Error?e.message:"A mentés sikertelen.")}finally{setBusy(false)}}
  async function clear(){setPoints([]);setBusy(true);setMessage("");try{await saveFieldBoundary(fieldId,null,null,null);if(markerRef.current&&mapRef.current){mapRef.current.removeLayer(markerRef.current);markerRef.current=null}setMessage("Térképi adatok törölve.")}catch(e){setMessage(e instanceof Error?e.message:"A törlés sikertelen.")}finally{setBusy(false)}}

  return <div className="field-map-card"><div className="field-map-head"><div><span className="eyebrow">TÉRKÉP ÉS TÁBLAHATÁR</span><h2>Földtábla térképen</h2></div>{editable&&<span className="user-pill">{points.length} pont</span>}</div><div ref={mapEl} className="field-real-map"/>{editable&&<div className="field-map-actions"><p>Kattints a térképen sorban a tábla sarkaira. Legalább 3 pont után elmenthető a határ.</p><div><button type="button" className="ghost-btn" disabled={busy||points.length===0} onClick={()=>setPoints(p=>p.slice(0,-1))}>Utolsó pont vissza</button><button type="button" className="ghost-btn" disabled={busy} onClick={clear}>Törlés</button><button type="button" className="btn btn-primary" disabled={busy||points.length<3} onClick={save}>{busy?"Mentés…":"Táblahatár mentése"}</button></div></div>}{message&&<div className="field-map-message">{message}</div>}</div>
}
