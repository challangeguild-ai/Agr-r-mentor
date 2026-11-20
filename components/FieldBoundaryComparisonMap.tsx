"use client";

import {useEffect,useRef,useState} from "react";

declare global{interface Window{L:any}}

type Props={
  previous:{lat:number|null;lng:number|null;boundary:unknown};
  proposed:{lat:number|null;lng:number|null;boundary:unknown};
};

// A single extent makes an incorrect location visible; independent maps would
// auto-zoom each candidate and could conceal a kilometre-scale displacement.
export function FieldBoundaryComparisonMap({previous,proposed}:Props){
  const container=useRef<HTMLDivElement|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false,map:any=null;
    const css="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const js="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    if(!document.querySelector(`link[href="${css}"]`)){
      const el=document.createElement("link");el.rel="stylesheet";el.href=css;document.head.appendChild(el);
    }
    const load=()=>new Promise<void>((resolve,reject)=>{
      if(window.L){resolve();return}
      let script=document.querySelector(`script[src="${js}"]`) as HTMLScriptElement|null;
      if(!script){script=document.createElement("script");script.src=js;script.async=true;document.body.appendChild(script)}
      const onLoad=()=>{cleanup();resolve()};
      const onError=()=>{cleanup();reject(new Error("A térképi modul nem tölthető be."))};
      const cleanup=()=>{script?.removeEventListener("load",onLoad);script?.removeEventListener("error",onError)};
      script.addEventListener("load",onLoad,{once:true});script.addEventListener("error",onError,{once:true});
    });
    (async()=>{
      await load();
      if(cancelled||!container.current)return;
      const L=window.L;
      map=L.map(container.current).setView([47.2,19.5],7);
      const satellite=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles © Esri"}).addTo(map);
      const street=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
      L.control.layers({"Műhold":satellite,"Utcatérkép":street},undefined,{position:"topright"}).addTo(map);
      const bounds=L.latLngBounds([]);
      const add=(data:Props["previous"],color:string,label:string)=>{
        if(data.boundary){
          const shape=L.geoJSON(data.boundary,{style:{color,weight:3,fillColor:color,fillOpacity:.18}}).addTo(map);
          shape.eachLayer((layer:any)=>layer.bindPopup(label));
          bounds.extend(shape.getBounds());
        }
        if(data.lat!==null&&data.lng!==null&&Number.isFinite(data.lat)&&Number.isFinite(data.lng)){
          const point=L.circleMarker([data.lat,data.lng],{radius:7,color:"#fff",weight:2,fillColor:color,fillOpacity:1})
            .bindPopup(`${label} – helypont`).addTo(map);
          bounds.extend(point.getLatLng());
        }
      };
      add(previous,"#2b8c49","Jelenlegi határ");
      add(proposed,"#de752a","Javasolt határ");
      if(bounds.isValid())map.fitBounds(bounds,{padding:[32,32],maxZoom:17});
    })().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Nem tölthető be a térkép.")});
    return()=>{cancelled=true;if(map)map.remove()};
  },[previous,proposed]);

  return <section className="panel" style={{marginTop:14}} aria-label="Táblahatárok összehasonlítása">
    <div className="panel-heading"><div><span className="eyebrow">KÖZÖS TÉRKÉP</span><h2>Régi és javasolt határ összevetése</h2></div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:13,fontWeight:700}}><span style={{color:"#2b8c49"}}>● Jelenlegi</span><span style={{color:"#c66317"}}>● Javasolt</span></div></div>
    <p style={{fontSize:13,color:"#526253",margin:"8px 0"}}>Mindkét alakzat azonos helyen és méretarányban látszik. A teljes poligon, a belső kivágások és a különálló területrészek megmaradnak.</p>
    <div ref={container} style={{height:440,width:"100%",borderRadius:12,background:"#dfe8db",overflow:"hidden"}}/>
    {error&&<p role="alert" style={{color:"#b3342b"}}>{error} A jóváhagyást a térkép nélkül ne végezd el.</p>}
  </section>;
}
