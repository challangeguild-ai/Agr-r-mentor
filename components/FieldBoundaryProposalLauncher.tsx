"use client";

import {useState} from "react";
import {FieldMapEditor} from "@/components/FieldMapEditor";

type ProposalStatus={status:string;created_at:string;review_note:string|null}|null;

type Props={
  fieldId:string;fieldName:string;lat:number|null;lng:number|null;areaHa:number|null;
  boundary:unknown;geometrySource?:string|null;
  lastProposal:ProposalStatus;enabled:boolean;
};

export function FieldBoundaryProposalLauncher({fieldId,fieldName,lat,lng,areaHa,boundary,geometrySource,lastProposal,enabled}:Props){
  const [editing,setEditing]=useState(false);
  const pending=lastProposal?.status==="pending";
  return <section className="panel" style={{marginTop:14}} aria-label="Táblahatár-javaslat">
    <div className="panel-heading"><div><span className="eyebrow">GAZDÁLKODÓI TÁBLAHATÁR</span><h2>Segíts meghatározni a(z) {fieldName} határát</h2></div>
      {!pending&&enabled&&<button className="btn btn-secondary" type="button" onClick={()=>setEditing(value=>!value)} aria-expanded={editing}>{editing?"Szerkesztő bezárása":"Táblahatár-javaslat készítése"}</button>}
    </div>
    <p style={{fontSize:13,color:"#526253",margin:"10px 0"}}>Nem kell minden adatot kitöltened: egy térképi pont, egy ingyenes OSM-javaslat, saját GeoJSON/SHP fájl, térképfotó vagy kézi körberajzolás is választható. Mindegyik módszer opcionális; a poligon minden töréspontját megőrizzük.</p>
    {pending?<p role="status" className="user-pill">⏳ Van már beküldött táblahatár-javaslat. Szaktanácsadói ellenőrzésre vár; újabbat az elbírálás után küldhetsz.</p>:null}
    {lastProposal?.status==="rejected"&&<p role="status" style={{color:"#9b3f25"}}>A korábbi javaslatot nem fogadták el.{lastProposal.review_note?` Indok: ${lastProposal.review_note}`:""} Új javaslat készíthető.</p>}
    {lastProposal?.status==="approved"&&<p role="status" style={{color:"#2f7430"}}>A legutóbbi javaslatot jóváhagyták; az elfogadott határ megjelenik a térképen.</p>}
    {!enabled&&<p role="status" style={{color:"#876a2b"}}>A táblahatár-beküldés az adatbázis frissítése után lesz elérhető. A meglévő térképi adatok továbbra is megtekinthetők.</p>}
    {editing&&!pending&&enabled&&<FieldMapEditor key={fieldId} fieldId={fieldId} lat={lat} lng={lng} areaHa={areaHa} boundary={boundary} geometrySource={geometrySource} editable proposalMode/>}
  </section>;
}
